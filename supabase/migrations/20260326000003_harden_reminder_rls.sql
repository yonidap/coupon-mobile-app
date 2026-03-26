-- =============================================================================
-- Migration: 20260326000003_harden_reminder_rls
-- Purpose:   Removes the voucher_reminders UPDATE policy for authenticated
--            mobile clients.
--
--            Reason:
--            sent_at is server-owned state managed exclusively by the
--            process-reminders Edge Function (service_role). Allowing mobile
--            clients to UPDATE voucher_reminders rows would let them suppress
--            or falsify delivery records. service_role bypasses RLS, so the
--            Edge Function does not need a policy to perform its UPDATE.
--
--            Mobile clients retain SELECT (read reminder state) and INSERT
--            (create reminder preferences) and DELETE (remove reminders).
--            They lose UPDATE entirely: there is no legitimate mobile-client
--            reason to mutate an existing reminder row.
-- =============================================================================

drop policy if exists "voucher_reminders: member update" on public.voucher_reminders;

comment on table public.voucher_reminders is
  'One row per (voucher, offset, channel) reminder slot. '
  'sent_at is owned by the server-side reminder pipeline (service_role). '
  'Authenticated mobile clients may SELECT, INSERT, and DELETE but NOT UPDATE.';
