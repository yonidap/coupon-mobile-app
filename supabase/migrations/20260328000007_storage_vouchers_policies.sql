-- =============================================================================
-- Migration: 20260328000007_storage_vouchers_policies
-- Purpose:   Enable authenticated wallet members to use the private
--            `vouchers` storage bucket for:
--              1) regular voucher attachments
--                 path: {wallet_id}/{voucher_id}/{filename}
--              2) extraction intake uploads
--                 path: intake/{wallet_id}/{user_id}/{filename}
--
-- Notes:
--   • Bucket remains private (public = false).
--   • intake objects are readable/deletable only by the uploading user.
--   • regular voucher objects are readable/deletable by wallet members.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('vouchers', 'vouchers', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'vouchers';

create or replace function public.try_parse_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

comment on function public.try_parse_uuid(text) is
  'Safely parses text to uuid. Returns NULL instead of throwing on invalid input.';

drop policy if exists "vouchers objects: authenticated insert" on storage.objects;
drop policy if exists "vouchers objects: authenticated select" on storage.objects;
drop policy if exists "vouchers objects: authenticated delete" on storage.objects;

create policy "vouchers objects: authenticated insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'vouchers'
    and case
      -- intake/{wallet_id}/{user_id}/{filename}
      when (string_to_array(name, '/'))[1] = 'intake' then
        public.is_wallet_member(public.try_parse_uuid((string_to_array(name, '/'))[2]))
        and public.try_parse_uuid((string_to_array(name, '/'))[3]) = auth.uid()
      -- {wallet_id}/{voucher_id}/{filename}
      else
        public.is_wallet_member(public.try_parse_uuid((string_to_array(name, '/'))[1]))
    end
  );

create policy "vouchers objects: authenticated select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'vouchers'
    and case
      when (string_to_array(name, '/'))[1] = 'intake' then
        public.is_wallet_member(public.try_parse_uuid((string_to_array(name, '/'))[2]))
        and public.try_parse_uuid((string_to_array(name, '/'))[3]) = auth.uid()
      else
        public.is_wallet_member(public.try_parse_uuid((string_to_array(name, '/'))[1]))
    end
  );

create policy "vouchers objects: authenticated delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'vouchers'
    and case
      when (string_to_array(name, '/'))[1] = 'intake' then
        public.is_wallet_member(public.try_parse_uuid((string_to_array(name, '/'))[2]))
        and public.try_parse_uuid((string_to_array(name, '/'))[3]) = auth.uid()
      else
        public.is_wallet_member(public.try_parse_uuid((string_to_array(name, '/'))[1]))
    end
  );
