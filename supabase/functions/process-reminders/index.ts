/**
 * process-reminders — Supabase Edge Function
 *
 * Scheduled entry point for the server-side voucher reminder delivery pipeline.
 * Intended to be invoked by a Supabase Cron job (pg_cron via pg_net) once or
 * twice daily. Can also be triggered manually for testing.
 *
 * PIPELINE PHASES (all happen in a single invocation)
 * ────────────────────────────────────────────────────
 *   1. Authorize    — verify the request carries the PROCESS_REMINDERS_SECRET
 *   2. Select       — query all active, non-expired vouchers via SQL helper
 *   3. Compute      — determine which (voucher, offset) pairs are due today
 *   4. Claim        — upsert voucher_reminders rows (idempotency gate)
 *   5. Resolve      — fetch push tokens for active, opted-in wallet members
 *   6. Deliver      — send push notifications via Expo push API
 *   7. Persist      — mark sent_at on successful reminder rows
 *   8. Summarize    — log a structured job summary
 *
 * See REMINDER_FLOW.md for the full design rationale, scheduling setup,
 * idempotency model, and future extension points.
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { isValidExpoPushToken, sendPushBatch } from '../_shared/expoPush.ts';
import type {
  ActiveVoucherRow,
  DuePair,
  ExpoPushMessage,
  JobSummary,
  PushTarget,
  ReminderSendResult,
  TokenSendResult,
  VoucherReminderRow,
} from '../_shared/types.ts';

// =============================================================================
// Phase 1 — Authorization
// =============================================================================

/**
 * Returns true when the request carries a valid PROCESS_REMINDERS_SECRET.
 *
 * The secret is expected as:  Authorization: Bearer <secret>
 *
 * If PROCESS_REMINDERS_SECRET is not set in the environment, the function
 * REJECTS the request. An absent secret is treated as a misconfiguration, not
 * a dev-friendly bypass. Set PROCESS_REMINDERS_SECRET in Supabase Dashboard
 * → Edge Functions → Secrets (production) or in .env.local (local dev via
 * `supabase functions serve --env-file .env.local`).
 *
 * There is intentionally no "accept if secret is missing" code path here.
 */
function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get('PROCESS_REMINDERS_SECRET');

  if (!secret) {
    console.error(
      '[process-reminders] PROCESS_REMINDERS_SECRET is not configured. ' +
        'Rejecting request. Set this secret before invoking the function.',
    );
    return false;
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' && token === secret;
}

// =============================================================================
// Phase 2 — Selection
// =============================================================================

/**
 * Fetches all active, non-expired vouchers with the wallet owner's reminder
 * offsets via the get_active_vouchers_for_reminders() SQL helper.
 *
 * Date semantics: expiry_date is a date-only column and days_until_expiry is
 * computed against the wallet owner's local calendar date inside Postgres.
 * The SQL helper uses the owner's profile.timezone with a UTC fallback.
 *
 * Extension point: per-voucher offset overrides are transparent to this call —
 * they are resolved inside the SQL function, not here.
 */
async function selectActiveVouchers(admin: SupabaseClient): Promise<ActiveVoucherRow[]> {
  const { data, error } = await admin.rpc('get_active_vouchers_for_reminders');

  if (error) {
    throw new Error(`[select] get_active_vouchers_for_reminders failed: ${error.message}`);
  }

  return (data ?? []) as ActiveVoucherRow[];
}

// =============================================================================
// Phase 3 — Compute due pairs
// =============================================================================

/**
 * For each voucher, determines which offsets are "due" today and returns the
 * corresponding (voucher, offset, channel) pairs.
 *
 * DUE SEMANTICS
 * ─────────────
 * An offset is due when: days_until_expiry === offset_days
 *
 * Each reminder fires on exactly the configured day — not earlier, not later.
 *
 * Example: voucher expires in 5 days, offsets = [30, 7, 1]
 *   offset 30 → 5 === 30 → NOT DUE ✗
 *   offset  7 → 5 ===  7 → NOT DUE ✗
 *   offset  1 → 5 ===  1 → NOT DUE ✗
 *   (Run again when days_until_expiry = 7 → offset 7 fires exactly then.)
 *
 * MISSED CRON RUNS
 * ────────────────
 * If the cron job does not run on a given day, reminders for that exact day
 * are permanently missed. This is an acceptable trade-off for a product where
 * users expect notifications on configured days (30/7/1), not as a burst
 * catch-up. To mitigate, schedule the cron to run twice daily (e.g. 06:00
 * and 12:00 UTC) so a transient scheduler failure is usually recovered within
 * the same calendar day.
 *
 * EXTENSION POINT: per-voucher offset overrides
 * ─────────────────────────────────────────────
 * v.owner_reminder_offsets currently comes from the wallet owner's profile.
 * When per-voucher overrides are added, the SQL function
 * get_active_vouchers_for_reminders() will return the resolved offsets
 * (coalescing voucher-level → profile-level). No change is needed here.
 *
 * EXTENSION POINT: email channel
 * ───────────────────────────────
 * To add email reminders, add a second loop that produces DuePairs with
 * channel='email' and a parallel delivery path in deliverReminder().
 */
function computeDuePairs(vouchers: ActiveVoucherRow[]): DuePair[] {
  const pairs: DuePair[] = [];

  for (const v of vouchers) {
    for (const offsetDays of v.owner_reminder_offsets) {
      if (v.days_until_expiry === offsetDays) {
        pairs.push({
          voucher_id: v.id,
          wallet_id: v.wallet_id,
          voucher_title: v.title,
          expiry_date: v.expiry_date,
          days_until_expiry: v.days_until_expiry,
          offset_days: offsetDays,
          channel: 'push',
        });
      }
    }
  }

  return pairs;
}

// =============================================================================
// Phase 4 — Claim reminder slots (idempotency gate)
// =============================================================================

/**
 * Bulk-inserts voucher_reminders rows for each due pair using
 * ON CONFLICT DO NOTHING (ignoreDuplicates: true).
 *
 * IDEMPOTENCY MODEL
 * ─────────────────
 * The unique constraint on (voucher_id, offset_days, channel) is the
 * idempotency key. The INSERT guarantees:
 *
 *   • New pair  → row is inserted with sent_at = null.
 *   • Existing row, sent_at IS NOT NULL → conflict ignored; row untouched.
 *   • Existing row, sent_at IS NULL     → conflict ignored; row untouched.
 *     (This handles previous runs where delivery failed before sent_at was set.)
 *
 * After the bulk-insert, we fetch all rows for our candidate vouchers where
 * sent_at IS NULL. This set includes:
 *   - Newly inserted rows from this run
 *   - Rows left unsent by a previous run (retry candidates)
 *
 * Rows with sent_at IS NOT NULL are already delivered and are excluded.
 * This means even if the job runs more than once per day, already-sent
 * reminders are never re-delivered.
 */
async function claimAndFetchPendingSlots(
  admin: SupabaseClient,
  pairs: DuePair[],
): Promise<VoucherReminderRow[]> {
  if (pairs.length === 0) return [];

  // Step 1: Upsert — claim new slots; leave existing slots untouched.
  const insertPayload = pairs.map((p) => ({
    voucher_id: p.voucher_id,
    offset_days: p.offset_days,
    channel: p.channel,
  }));

  const { error: insertError } = await admin
    .from('voucher_reminders')
    .upsert(insertPayload, { onConflict: 'voucher_id,offset_days,channel', ignoreDuplicates: true });

  if (insertError) {
    throw new Error(`[claim] Failed to upsert voucher_reminders: ${insertError.message}`);
  }

  // Step 2: Fetch all unsent rows for our candidate set.
  // We scope the query to only the vouchers in this run to avoid loading
  // unrelated historical data.
  const voucherIds = [...new Set(pairs.map((p) => p.voucher_id))];

  const { data, error: fetchError } = await admin
    .from('voucher_reminders')
    .select('id, voucher_id, offset_days, channel, sent_at')
    .in('voucher_id', voucherIds)
    .is('sent_at', null)
    .eq('channel', 'push'); // Only push is implemented in this function.

  if (fetchError) {
    throw new Error(`[claim] Failed to fetch pending voucher_reminders: ${fetchError.message}`);
  }

  return (data ?? []) as VoucherReminderRow[];
}

// =============================================================================
// Phase 5 — Recipient resolution
// =============================================================================

/**
 * Fetches all push tokens for active, opted-in members of the given wallet.
 *
 * Uses the get_wallet_push_targets() SQL helper which filters by:
 *   - wallet_members.status = 'active'
 *   - profiles.notifications_enabled = true
 *   - Existence of at least one push_tokens row
 *
 * For MVP (personal wallets), this returns the wallet owner's tokens only.
 * For future family/shared wallets it automatically includes all active,
 * opted-in members — no code change required here or in the SQL function.
 *
 * Non-fatal: DB errors are caught and logged; an empty array is returned so
 * the reminder row is left with sent_at = null and will be retried next run.
 */
async function resolveRecipients(admin: SupabaseClient, walletId: string): Promise<PushTarget[]> {
  const { data, error } = await admin.rpc('get_wallet_push_targets', {
    p_wallet_id: walletId,
  });

  if (error) {
    console.error(
      `[process-reminders] resolveRecipients failed for wallet ${walletId}: ${error.message}`,
    );
    return [];
  }

  const targets: PushTarget[] = [];

  for (const row of (data ?? []) as { user_id: string; expo_push_token: string }[]) {
    if (isValidExpoPushToken(row.expo_push_token)) {
      targets.push({ user_id: row.user_id, expo_push_token: row.expo_push_token });
    } else {
      console.warn(
        `[process-reminders] Skipping malformed push token for user ${row.user_id}: "${row.expo_push_token}"`,
      );
    }
  }

  return targets;
}

// =============================================================================
// Phase 6 — Deliver
// =============================================================================

/**
 * Builds push messages for each target and sends them via the Expo push API.
 * Returns a structured result for each token so the caller can log failures
 * individually and decide whether to mark the reminder as sent.
 *
 * MESSAGE COPY
 * ────────────
 * The notification body names the voucher and describes how soon it expires
 * in plain language (today / tomorrow / in N days). Tap data includes
 * the voucher_id so the mobile app can deep-link directly to the voucher.
 *
 * ANDROID CHANNEL
 * ────────────────
 * channelId 'voucher-reminders' must be registered in the mobile app using
 * expo-notifications setNotificationChannelAsync() before notifications can
 * appear on Android Q+. See src/providers/ for the recommended setup location.
 *
 * EXTENSION POINT: per-user notification copy / locale
 * ────────────────────────────────────────────────────
 * The message copy is currently in English. When i18n is needed, pass the
 * target user's language (from their profile) through the PushTarget struct
 * and select the appropriate string here.
 */
function buildMessage(pair: DuePair, target: PushTarget): ExpoPushMessage {
  const daysLabel =
    pair.days_until_expiry === 0
      ? 'today'
      : pair.days_until_expiry === 1
        ? 'tomorrow'
        : `in ${pair.days_until_expiry} day${pair.days_until_expiry === 1 ? '' : 's'}`;

  return {
    to: target.expo_push_token,
    title: `Coupon expiring ${daysLabel}`,
    body: `"${pair.voucher_title}" expires ${daysLabel}. Tap to view it now.`,
    data: {
      // Structured payload for the mobile app's notification handler.
      type: 'VOUCHER_REMINDER',
      voucher_id: pair.voucher_id,
      offset_days: pair.offset_days,
    },
    sound: 'default',
    priority: 'high',
    channelId: 'voucher-reminders',
  };
}

async function deliverReminder(
  pair: DuePair,
  slot: VoucherReminderRow,
  targets: PushTarget[],
): Promise<ReminderSendResult> {
  if (targets.length === 0) {
    return {
      reminder_id: slot.id,
      voucher_id: slot.voucher_id,
      offset_days: slot.offset_days,
      token_results: [],
      any_success: false,
    };
  }

  const messages = targets.map((t) => buildMessage(pair, t));
  const tokenResults: TokenSendResult[] = await sendPushBatch(messages);
  const anySuccess = tokenResults.some((r) => r.ticket.status === 'ok');

  return {
    reminder_id: slot.id,
    voucher_id: slot.voucher_id,
    offset_days: slot.offset_days,
    token_results: tokenResults,
    any_success: anySuccess,
  };
}

// =============================================================================
// Phase 7 — Persist
// =============================================================================

/**
 * Marks a reminder row as sent by setting sent_at to the current timestamp.
 *
 * The `.is('sent_at', null)` guard prevents an already-committed sent_at
 * from being overwritten in case of concurrent executions.
 *
 * Non-fatal: DB errors are logged but do not abort the run. The worst outcome
 * is that the same reminder is re-sent on the next run (acceptable for push
 * notifications).
 */
async function markReminderSent(admin: SupabaseClient, reminderId: string): Promise<void> {
  const { error } = await admin
    .from('voucher_reminders')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', reminderId)
    .is('sent_at', null);

  if (error) {
    console.error(
      `[process-reminders] Failed to mark reminder ${reminderId} as sent: ${error.message}`,
    );
  }
}

// =============================================================================
// Orchestration
// =============================================================================

async function runReminderJob(admin: SupabaseClient): Promise<JobSummary> {
  const summary: JobSummary = {
    vouchers_evaluated: 0,
    due_pairs_computed: 0,
    reminder_slots_claimed: 0,
    reminders_attempted: 0,
    push_sends_attempted: 0,
    push_sends_succeeded: 0,
    push_sends_failed: 0,
    errors: [],
  };

  // ── Phase 2: Select ────────────────────────────────────────────────────────
  let activeVouchers: ActiveVoucherRow[];

  try {
    activeVouchers = await selectActiveVouchers(admin);
  } catch (err) {
    summary.errors.push(`Selection failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }

  summary.vouchers_evaluated = activeVouchers.length;
  console.log(`[process-reminders] Evaluated ${activeVouchers.length} active voucher(s).`);

  // ── Phase 3: Compute ───────────────────────────────────────────────────────
  const duePairs = computeDuePairs(activeVouchers);
  summary.due_pairs_computed = duePairs.length;
  console.log(`[process-reminders] ${duePairs.length} due pair(s) computed.`);

  if (duePairs.length === 0) {
    console.log('[process-reminders] No reminders are due. Exiting early.');
    return summary;
  }

  // ── Phase 4: Claim ─────────────────────────────────────────────────────────
  let pendingSlots: VoucherReminderRow[];

  try {
    pendingSlots = await claimAndFetchPendingSlots(admin, duePairs);
  } catch (err) {
    summary.errors.push(`Claim failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }

  summary.reminder_slots_claimed = pendingSlots.length;
  console.log(`[process-reminders] ${pendingSlots.length} pending slot(s) to deliver.`);

  if (pendingSlots.length === 0) {
    console.log('[process-reminders] All due reminders already sent. Exiting.');
    return summary;
  }

  // Build a lookup map for O(1) pair resolution during the delivery loop.
  // Key: "voucher_id::offset_days::channel"
  const pairByKey = new Map<string, DuePair>();
  for (const p of duePairs) {
    pairByKey.set(`${p.voucher_id}::${p.offset_days}::${p.channel}`, p);
  }

  // Cache resolved recipients per wallet to avoid redundant DB queries when
  // the same wallet has multiple due reminders in a single run.
  const recipientsByWallet = new Map<string, PushTarget[]>();

  // ── Phases 5 + 6 + 7: Resolve → Deliver → Persist ─────────────────────────
  for (const slot of pendingSlots) {
    const pairKey = `${slot.voucher_id}::${slot.offset_days}::${slot.channel}`;
    const pair = pairByKey.get(pairKey);

    if (!pair) {
      // This can happen when a voucher_reminders row exists from a previous
      // run with different offsets that no longer appear in the current
      // profile settings. Skip rather than error — the row is harmless.
      console.log(
        `[process-reminders] No matching due pair for reminder ${slot.id} (voucher=${slot.voucher_id}, offset=${slot.offset_days}) — skipping.`,
      );
      continue;
    }

    // Phase 5: Recipients
    let targets = recipientsByWallet.get(pair.wallet_id);
    if (targets === undefined) {
      targets = await resolveRecipients(admin, pair.wallet_id);
      recipientsByWallet.set(pair.wallet_id, targets);
    }

    summary.reminders_attempted++;

    if (targets.length === 0) {
      console.log(
        `[process-reminders] No push targets for wallet ${pair.wallet_id}, ` +
          `voucher ${pair.voucher_id} — skipping. Reminder will retry on next run.`,
      );
      // Do NOT mark sent_at: allows retry when the user registers a token.
      continue;
    }

    // Phase 6: Deliver
    const result = await deliverReminder(pair, slot, targets);
    const succeeded = result.token_results.filter((r) => r.ticket.status === 'ok').length;
    const failed = result.token_results.filter((r) => r.ticket.status === 'error').length;

    summary.push_sends_attempted += result.token_results.length;
    summary.push_sends_succeeded += succeeded;
    summary.push_sends_failed += failed;

    // Log individual token-level failures for operational visibility.
    for (const tr of result.token_results) {
      if (tr.ticket.status === 'error') {
        const errCode = tr.ticket.details?.error ?? 'unknown';
        console.error(
          `[process-reminders] Push failed — token=${tr.token.slice(0, 20)}... ` +
            `voucher=${pair.voucher_id} offset=${pair.offset_days} ` +
            `errCode=${errCode} message=${tr.ticket.message ?? ''}`,
        );

        // FUTURE: When DeviceNotRegistered errors are detected, the stale
        // token should be removed from push_tokens to keep the table clean.
        // That cleanup can be added here without changing the rest of the flow.
        // if (errCode === 'DeviceNotRegistered') { await removeStaleToken(admin, tr.token); }
      }
    }

    // Phase 7: Persist
    // Mark sent_at if at least one token received a successful ticket.
    // If ALL deliveries failed, leave sent_at null so the next run retries.
    // This means a reminder is considered "sent" when it reached at least
    // one of the user's devices — acceptable for MVP.
    if (result.any_success) {
      await markReminderSent(admin, slot.id);
    } else {
      console.warn(
        `[process-reminders] All deliveries failed for reminder ${slot.id} — will retry on next run.`,
      );
      summary.errors.push(
        `All deliveries failed for reminder ${slot.id} (voucher=${slot.voucher_id}, offset=${slot.offset_days})`,
      );
    }
  }

  return summary;
}

// =============================================================================
// HTTP entry point
// =============================================================================

Deno.serve(async (req: Request) => {
  // Only accept POST requests. Supabase Cron uses POST; GET is rejected
  // to prevent accidental browser-triggered runs.
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!isAuthorized(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let admin: SupabaseClient;

  try {
    admin = createAdminClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[process-reminders] Admin client init failed:', message);
    return new Response(JSON.stringify({ error: 'Admin client init failed', detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const startedAt = new Date().toISOString();
  console.log('[process-reminders] Job started at', startedAt);

  let summary: JobSummary;

  try {
    summary = await runReminderJob(admin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[process-reminders] Unhandled error in runReminderJob:', message);
    return new Response(JSON.stringify({ error: 'Unhandled job error', detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const completedAt = new Date().toISOString();

  console.log('[process-reminders] Job completed at', completedAt, '— summary:', JSON.stringify(summary));

  return new Response(
    JSON.stringify({ ok: true, started_at: startedAt, completed_at: completedAt, summary }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
