/**
 * Shared TypeScript types for the reminder delivery pipeline.
 *
 * These types are internal to Supabase Edge Functions and are NOT shared
 * with the mobile app. Mobile-app domain types live in src/types/domain.ts.
 */

// ---------------------------------------------------------------------------
// Returned by get_active_vouchers_for_reminders() SQL function
// ---------------------------------------------------------------------------

export interface ActiveVoucherRow {
  id: string;
  wallet_id: string;
  title: string;
  /** 'YYYY-MM-DD' — a date-only string, no time component. Math is based on the wallet owner's local calendar date. */
  expiry_date: string;
  /** (expiry_date - owner_local_date), always >= 0 because the SQL filters expired rows. */
  days_until_expiry: number;
  /** Reminder offsets in days-before-expiry from the wallet owner's profile. */
  owner_reminder_offsets: number[];
}

// ---------------------------------------------------------------------------
// A single (voucher, offset, channel) reminder that is due to be sent
// ---------------------------------------------------------------------------

export interface DuePair {
  voucher_id: string;
  wallet_id: string;
  voucher_title: string;
  /** 'YYYY-MM-DD' */
  expiry_date: string;
  days_until_expiry: number;
  offset_days: number;
  /** Only 'push' is implemented. 'email' is a future extension. */
  channel: 'push' | 'email';
}

// ---------------------------------------------------------------------------
// A row from voucher_reminders (subset of columns used by the job)
// ---------------------------------------------------------------------------

export interface VoucherReminderRow {
  id: string;
  voucher_id: string;
  offset_days: number;
  channel: 'push' | 'email';
  sent_at: string | null;
}

// ---------------------------------------------------------------------------
// Returned by get_wallet_push_targets(uuid) SQL function
// ---------------------------------------------------------------------------

export interface PushTarget {
  user_id: string;
  expo_push_token: string;
}

// ---------------------------------------------------------------------------
// Expo Push API types
// ---------------------------------------------------------------------------

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  ttl?: number;
  priority?: 'default' | 'normal' | 'high';
  /**
   * Android notification channel ID. The mobile app must create a channel
   * with this ID using expo-notifications. Required for Android O+ (API 26+).
   */
  channelId?: string;
}

/**
 * A push ticket returned by the Expo push API for one message.
 *
 * status='ok'    → Expo has accepted the message for delivery (not yet
 *                  confirmed delivered; use receipt checking for that).
 * status='error' → Expo rejected the message; check details.error for the
 *                  canonical error code.
 *
 * FUTURE: Receipt checking (POST /--/api/v2/push/getReceipts) can be
 * implemented by storing ticket.id in voucher_reminders and running a
 * separate receipt-checking Edge Function on a delayed schedule.
 */
export interface ExpoPushTicket {
  status: 'ok' | 'error';
  /** Receipt ID for the async delivery confirmation pipeline. Only present on 'ok'. */
  id?: string;
  /** Human-readable error message. Only present on 'error'. */
  message?: string;
  details?: {
    /**
     * Canonical error codes from Expo:
     *   DeviceNotRegistered  — token is stale; should be removed from push_tokens
     *   MessageTooBig        — payload exceeded 4096 bytes
     *   MessageRateExceeded  — slow down
     *   MismatchSenderId     — wrong FCM sender ID
     */
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'MismatchSenderId' | string;
  };
}

export interface TokenSendResult {
  token: string;
  ticket: ExpoPushTicket;
}

// ---------------------------------------------------------------------------
// Per-reminder delivery outcome
// ---------------------------------------------------------------------------

export interface ReminderSendResult {
  reminder_id: string;
  voucher_id: string;
  offset_days: number;
  token_results: TokenSendResult[];
  /** True when at least one push token received a successful ticket from Expo. */
  any_success: boolean;
}

// ---------------------------------------------------------------------------
// Summary logged at the end of each job run
// ---------------------------------------------------------------------------

export interface JobSummary {
  vouchers_evaluated: number;
  due_pairs_computed: number;
  reminder_slots_claimed: number;
  reminders_attempted: number;
  push_sends_attempted: number;
  push_sends_succeeded: number;
  push_sends_failed: number;
  /**
   * Non-fatal errors encountered during the run. Fatal errors abort the job
   * and are returned as an HTTP 500 response, not stored here.
   */
  errors: string[];
}
