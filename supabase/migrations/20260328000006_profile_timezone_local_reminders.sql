-- =============================================================================
-- Migration: 20260328000006_profile_timezone_local_reminders
-- Purpose:   Store each profile's IANA timezone and use the wallet owner's
--            local calendar date when calculating reminder due dates.
--
--            Reminder matching remains idempotent and slot-based:
--              • voucher_reminders unique key stays (voucher_id, offset_days, channel)
--              • process-reminders still claims rows the same way
--              • only the date math feeding days_until_expiry changes
--
--            Rule chosen for MVP:
--              The wallet owner's profile timezone is the source of truth.
--              For personal wallets, that is the current user's timezone.
--
--            Existing rows default to UTC until the mobile app captures the
--            device timezone and writes it back through the profile upsert path.
-- =============================================================================

alter table public.profiles
  add column if not exists timezone text not null default 'UTC';

comment on column public.profiles.timezone is
  'IANA timezone used to evaluate local calendar dates for reminder math. '
  'The wallet owner''s profile timezone controls reminder scheduling. '
  'Examples: America/New_York, Europe/London, Asia/Jerusalem.';

create or replace function public.get_active_vouchers_for_reminders()
returns table (
  id                     uuid,
  wallet_id              uuid,
  title                  text,
  expiry_date            text,
  days_until_expiry      integer,
  owner_reminder_offsets integer[]
)
language sql
stable
security definer
set search_path = public
as $$
  with owner_calendar as (
    select
      v.id,
      v.wallet_id,
      v.title,
      v.expiry_date,
      p.default_reminder_offsets,
      (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date as owner_today
    from public.vouchers v
    join public.wallets  w  on w.id = v.wallet_id
    join public.profiles p  on p.id = w.owner_user_id
    where v.status = 'active'
      and v.expiry_date >= (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
      and v.expiry_date <= (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date + 365
  )
  select
    id,
    wallet_id,
    title,
    expiry_date::text                        as expiry_date,
    (expiry_date - owner_today)::integer     as days_until_expiry,
    default_reminder_offsets                 as owner_reminder_offsets
  from owner_calendar
  order by expiry_date asc
$$;

comment on function public.get_active_vouchers_for_reminders() is
  'Returns all active non-expired vouchers with the wallet owner''s local days-until-expiry. '
  'Reminder math is evaluated against the owner''s profile timezone, not UTC. '
  'Used exclusively by the process-reminders Edge Function.';
