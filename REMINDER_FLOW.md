# Reminder Delivery Flow

Server-side voucher reminder pipeline for the Coupon Wallet app.  
Implemented as a single Supabase Edge Function (`process-reminders`) triggered by a scheduled cron job.

---

## Architecture decision: single function

The reminder pipeline runs as **one function with six internal phases** rather than two separate functions (enqueue + deliver). The tradeoff:

| Approach | Benefit | Downside |
|---|---|---|
| Single function | Simpler ops, no inter-function HTTP call, easier to reason about | All phases must complete within the Deno function timeout (~150 s) |
| Split (enqueue + deliver) | Each function is independently scalable and testable | Adds a job queue, inter-function auth, and deployment complexity |

For MVP with personal wallets and a typical user base, a single daily invocation will process all due reminders well within the timeout. **When the reminder volume justifies it**, split at the `pendingSlots` boundary: the enqueue function writes `voucher_reminders` rows; the deliver function consumes them. The internal phase boundaries in `index.ts` are already drawn to make that refactor additive.

---

## File map

```
supabase/
  config.toml                                  — Supabase CLI / local dev config
  functions/
    import_map.json                            — pinned Deno import versions
    _shared/
      types.ts                                 — internal pipeline types
      supabaseAdmin.ts                         — service-role client factory
      expoPush.ts                              — Expo push API wrapper
    process-reminders/
      index.ts                                 — main Edge Function (all phases)
  migrations/
    20260326000001_initial_schema.sql          — all business tables + RLS
    20260326000002_reminder_helpers.sql        — reminder-specific SQL additions
```

---

## Pipeline phases

```
POST /functions/v1/process-reminders
           │
           ▼
  1. Authorize          verify Authorization: Bearer <PROCESS_REMINDERS_SECRET>
           │
           ▼
  2. Select             get_active_vouchers_for_reminders()
                        → active vouchers + wallet owner's reminder offsets
           │
           ▼
  3. Compute            for each voucher: which offsets match days_until_expiry exactly?
                        (days_until_expiry <= offset_days)
           │
           ▼
  4. Claim              INSERT INTO voucher_reminders ON CONFLICT DO NOTHING
                        idempotency gate — prevents duplicate sends
           │
           ▼
  5. Resolve            get_wallet_push_targets(wallet_id)
                        → push tokens for opted-in active wallet members
           │
           ▼
  6. Deliver            send via Expo push API (chunked batches of 100)
           │
           ▼
  7. Persist            UPDATE voucher_reminders SET sent_at = now()
                        only when at least one push token succeeded
           │
           ▼
  8. Summarize          structured JSON log + HTTP 200 response body
```

---

## Environment variables / secrets

| Variable | Where set | Description |
|---|---|---|
| `SUPABASE_URL` | Injected automatically by Supabase runtime | Project API URL. Do not add to `.env`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected automatically by Supabase runtime | Service-role key. Do not add to `.env`. Never expose to mobile. |
| `PROCESS_REMINDERS_SECRET` | Supabase Dashboard → Edge Functions → Secrets | Required. Missing or incorrect secret always rejects the request. |

Set `PROCESS_REMINDERS_SECRET` in the Supabase Dashboard:
> Settings → Edge Functions → process-reminders → Secrets → Add secret

---

## Scheduling setup (manual Supabase steps)

The function is designed to be called by Supabase's built-in scheduler. Two options:

### Option A — Supabase Dashboard Cron (recommended)

1. Open **Supabase Dashboard → Database → pg_cron**.
2. Create a new job:
   ```sql
   select cron.schedule(
     'process-reminders-daily',
     '0 6 * * *',   -- 06:00 UTC every day; adjust to your preferred time
     $$
       select net.http_post(
         url     := 'https://<your-project-ref>.supabase.co/functions/v1/process-reminders',
         headers := jsonb_build_object(
           'Content-Type',  'application/json',
           'Authorization', 'Bearer ' || current_setting('app.process_reminders_secret')
         ),
         body    := '{}'::jsonb
       )
     $$
   );
   ```
3. Store the secret in Postgres config so the SQL can reference it:
   ```sql
   alter database postgres set app.process_reminders_secret = '<your-secret>';
   ```
   *(Or hard-code the secret directly in the cron SQL if you prefer — just be aware it will be visible in pg_cron's job table.)*

### Option B — External cron (e.g. GitHub Actions, Railway Cron)

Send a `POST` request with the secret header:

```bash
curl -X POST \
  -H "Authorization: Bearer $PROCESS_REMINDERS_SECRET" \
  -H "Content-Type: application/json" \
  https://<your-project-ref>.supabase.co/functions/v1/process-reminders
```

---

## Idempotency model

| Scenario | Behaviour |
|---|---|
| Function runs twice on the same day | Second run finds all`sent_at IS NOT NULL`; exits early. Zero duplicate sends. |
| Function crashes after send but before `UPDATE sent_at` | Row still has `sent_at IS NULL`; next run re-sends. Risk: one duplicate notification per crash. Acceptable for push. |
| Function missed a day (cron was down) | Reminders for that exact calendar day are permanently missed. To reduce this risk, schedule the cron to run twice daily (e.g. 06:00 and 12:00 UTC) so a transient scheduler failure is usually recovered within the same day. |
| User registers a new device mid-day | Their token is not yet in `push_tokens` when the function ran; `sent_at` is NOT set (no targets case); next day's run delivers to the new device. |
| Two concurrent executions | Both try to `INSERT ON CONFLICT DO NOTHING`; only one inserts each row. Both fetch the same unsent rows. Both attempt to `UPDATE sent_at WHERE sent_at IS NULL`. The second `UPDATE` is a no-op (already set). Worst case: one duplicate notification if both ran the Expo send before either committed `sent_at`. |

The concurrent-execution risk above is mitigated by scheduling the cron to run at a single time per day. For a more strict "exactly-once" guarantee, add a `SELECT ... FOR UPDATE SKIP LOCKED` step after claiming, but this is unnecessary complexity for MVP.

---

## Date and timezone semantics

- `vouchers.expiry_date` is a `DATE` column with no time component.
- `CURRENT_DATE` in Postgres evaluates to the current date **in UTC**.
- Edge Functions run in UTC.
- `days_until_expiry = expiry_date - CURRENT_DATE` is always an integer number of days.
- A voucher expiring on `2026-04-10` with offset `7` fires when `CURRENT_DATE = 2026-04-03`.

**If per-timezone delivery is needed in the future:** add a `timezone text` column to `profiles`, compute the user's local date in the SQL function using `(now() AT TIME ZONE p.timezone)::date`, and replace `CURRENT_DATE` in the helper function.

---

## Current MVP assumptions

1. **Personal wallets only** — a wallet has one active member (the owner). The recipient resolution query already handles multiple members, so family/shared wallets work without code changes.
2. **Push channel only** — the `channel` column exists for forward-compatibility; only `'push'` is implemented.
3. **One reminder per (voucher, offset) regardless of number of members** — a single `voucher_reminders` row tracks delivery for the whole wallet. If per-member tracking is needed later, the unique key changes to `(voucher_id, offset_days, channel, user_id)`.
4. **Profile-level offsets only** — every voucher in a wallet uses the wallet owner's `default_reminder_offsets`.
5. **No receipt checking** — Expo tickets with `status='ok'` are trusted as successful. Receipt checking (confirming APNs/FCM delivery) is deferred.

---

## Future extension points

### Per-voucher reminder offset overrides
1. Add a `voucher_reminder_settings` table: `(voucher_id, offsets integer[], created_at)`.
2. In `get_active_vouchers_for_reminders()`, replace `p.default_reminder_offsets` with `coalesce(vrs.offsets, p.default_reminder_offsets)` via a LEFT JOIN.
3. No changes needed in the Edge Function TypeScript.

### Email channel
1. Add `channel = 'email'` to the `computeDuePairs` output (controlled by a feature flag or profile setting).
2. Add an `emailDeliverReminder()` function that calls a transactional email provider (e.g. Resend, Postmark).
3. Route by `pair.channel` in the delivery loop in `index.ts`.
4. The idempotency model (unique on `voucher_id, offset_days, channel`) already handles both channels independently.

### Digest notifications
1. Add a `digest_reminders boolean` column to `profiles`.
2. In the deliver loop, group reminders by wallet/user instead of sending per-voucher.
3. Build a single digest push message listing all expiring vouchers.

### Receipt checking (Expo delivery confirmation)
1. Add a `ticket_id text` column to `voucher_reminders`.
2. Store `r.ticket.id` in `ticket_id` when `status='ok'`.
3. Create a second Edge Function `check-reminder-receipts` that queries Expo's receipt API with all unconfirmed ticket IDs and updates a `delivered_at` column.
4. Schedule it ~30 minutes after `process-reminders`.

### Stale token cleanup
In `index.ts`, after a `DeviceNotRegistered` error ticket:
```typescript
// Already sketched as a TODO comment in the delivery loop.
await admin.from('push_tokens').delete().eq('expo_push_token', tr.token);
```

### Per-wallet notification preferences
1. Add a `wallet_notification_settings (wallet_id, user_id, notifications_enabled, reminder_offsets)` table.
2. In `get_wallet_push_targets()`, add a LEFT JOIN to that table and filter accordingly.
3. `process-reminders` has no awareness of this — the SQL function handles it.

---

## Local development

```bash
# Start local Supabase (Docker required)
npx supabase start

# Apply migrations
npx supabase db push

# Serve Edge Functions locally
npx supabase functions serve process-reminders --env-file .env.local

# Invoke manually
curl -X POST http://localhost:54321/functions/v1/process-reminders \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json"
```

Create `.env.local` (never commit this file):
```env
PROCESS_REMINDERS_SECRET=dev-secret
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically injected by `supabase functions serve`.

---

## Deploy

```bash
# Deploy the function
npx supabase functions deploy process-reminders

# Set the secret (one-time, or when rotating)
npx supabase secrets set PROCESS_REMINDERS_SECRET=<your-production-secret>
```
