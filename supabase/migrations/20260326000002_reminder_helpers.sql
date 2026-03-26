-- =============================================================================
-- Migration: 20260326000002_reminder_helpers
-- Purpose:   Adds the database primitives required by the server-side reminder
--            delivery pipeline:
--
--              1. profiles.default_reminder_offsets — per-user reminder offsets
--              2. idx_vouchers_active_expiry         — fast scan for the cron job
--              3. get_active_vouchers_for_reminders()— selection query for the job
--              4. get_wallet_push_targets(uuid)      — recipient resolution query
--
--            All helper functions use SECURITY DEFINER so they can be called
--            from a PostgREST RPC context while still enforcing the intended
--            data scope. The Edge Function itself runs as service_role (which
--            bypasses RLS) but using SECURITY DEFINER keeps these functions
--            safe if ever called from a lower-privilege context.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Add default_reminder_offsets to profiles
--
--    Stores the ordered list of days-before-expiry at which push reminders
--    should fire for this user.  The Edge Function reads this array and
--    generates one voucher_reminders row per (voucher, offset, channel) pair.
--
--    Defaults to [30, 7, 1] matching the mobile app constant
--    DEFAULT_REMINDER_OFFSETS_DAYS in src/features/settings/defaults.ts.
--
--    Per-voucher offset overrides will plug in later via a separate
--    voucher_reminder_settings table. The Edge Function is written to
--    call a separate SQL function for offset resolution so that extension
--    is a single-file change (see get_active_vouchers_for_reminders below).
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists default_reminder_offsets integer[]
    not null default '{30,7,1}'::integer[];

comment on column public.profiles.default_reminder_offsets is
  'Ordered list of days-before-expiry at which push reminders fire. '
  'Example: {30,7,1} fires 30, 7, and 1 day(s) before expiry. '
  'Per-voucher overrides can be added with a voucher_reminder_settings table '
  'and a corresponding code change in get_active_vouchers_for_reminders().';


-- ---------------------------------------------------------------------------
-- 2. Composite partial index for the nightly reminder scan
--
--    The Edge Function queries all active vouchers with upcoming expiry dates.
--    This index makes that scan efficient even as the vouchers table grows.
--    The partial predicate (status = 'active') keeps the index small by
--    excluding redeemed, expired, and archived rows.
-- ---------------------------------------------------------------------------

create index if not exists idx_vouchers_active_expiry
  on public.vouchers(expiry_date asc)
  where status = 'active';

comment on index public.idx_vouchers_active_expiry is
  'Supports the server-side reminder job scan: '
  'active vouchers ordered by ascending expiry date.';


-- ---------------------------------------------------------------------------
-- 3. get_active_vouchers_for_reminders()
--
--    Returns every active, non-expired voucher together with:
--      - days_until_expiry  : (expiry_date - CURRENT_DATE), always >= 0
--      - owner_reminder_offsets : from the wallet owner's profile
--
--    DATE SEMANTICS
--    ──────────────
--    expiry_date is a DATE column (no time component). CURRENT_DATE is
--    evaluated in UTC inside Postgres. Edge Functions run in UTC. This means
--    "days until expiry" is consistent regardless of the user's local timezone.
--    If per-timezone delivery is ever needed, store a timezone column on
--    profiles and adjust the WHERE clause here.
--
--    SCAN WINDOW
--    ───────────
--    We limit the scan to vouchers expiring within the next 365 days. This
--    covers any realistic reminder offset while keeping the result set bounded.
--    Vouchers expiring further out will be picked up on future runs.
--
--    EXTENSION POINT (per-voucher offset overrides)
--    ───────────────────────────────────────────────
--    When per-voucher override support is added, replace or extend the
--    owner_reminder_offsets column in this query with logic like:
--
--        coalesce(
--          (select offsets from voucher_reminder_settings where voucher_id = v.id),
--          p.default_reminder_offsets
--        ) as owner_reminder_offsets
--
--    No changes outside this function are required for that extension.
-- ---------------------------------------------------------------------------

create or replace function public.get_active_vouchers_for_reminders()
returns table (
  id                     uuid,
  wallet_id              uuid,
  title                  text,
  expiry_date            text,    -- 'YYYY-MM-DD', cast for safe JS handling
  days_until_expiry      integer,
  owner_reminder_offsets integer[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.wallet_id,
    v.title,
    v.expiry_date::text                        as expiry_date,
    (v.expiry_date - current_date)::integer    as days_until_expiry,
    p.default_reminder_offsets                 as owner_reminder_offsets
  from public.vouchers v
  join public.wallets  w  on w.id = v.wallet_id
  join public.profiles p  on p.id = w.owner_user_id
  where v.status      = 'active'
    and v.expiry_date >= current_date
    and v.expiry_date <= current_date + interval '365 days'
  order by v.expiry_date asc
$$;

comment on function public.get_active_vouchers_for_reminders() is
  'Returns all active non-expired vouchers with the wallet owner''s reminder offsets. '
  'Used exclusively by the process-reminders Edge Function. '
  'Modify ONLY this function when adding per-voucher offset override support.';


-- ---------------------------------------------------------------------------
-- 4. get_wallet_push_targets(p_wallet_id uuid)
--
--    Returns (user_id, expo_push_token) for every active wallet member who:
--      - has notifications_enabled = true on their profile
--      - has at least one registered push token
--
--    For MVP (personal wallets), this returns exactly the owner's tokens.
--    For future family/shared wallets this automatically includes all
--    active, opted-in members — no code change required.
--
--    FUTURE REFINEMENT POINTS
--    ────────────────────────
--    • Filter by wm.role if viewers should not receive family-wallet reminders.
--    • Join with a wallet_notification_settings table for per-wallet opt-outs.
--    • Add a `valid_until` column to push_tokens to expire stale tokens.
-- ---------------------------------------------------------------------------

create or replace function public.get_wallet_push_targets(p_wallet_id uuid)
returns table (
  user_id          uuid,
  expo_push_token  text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pt.user_id,
    pt.expo_push_token
  from public.wallet_members wm
  join public.profiles    p  on p.id  = wm.user_id and p.notifications_enabled = true
  join public.push_tokens pt on pt.user_id = wm.user_id
  where wm.wallet_id = p_wallet_id
    and wm.status    = 'active'
$$;

comment on function public.get_wallet_push_targets(uuid) is
  'Returns all push tokens for active, opted-in members of the given wallet. '
  'Used by the process-reminders Edge Function for recipient resolution. '
  'Add role filtering or per-wallet preference joins here when needed.';
