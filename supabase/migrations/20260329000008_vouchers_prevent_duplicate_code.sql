-- Enforce voucher code uniqueness within each wallet.
-- Codes are compared case-insensitively and ignore surrounding whitespace,
-- matching the app-side normalization used during save and validation.

create or replace function public.prevent_duplicate_voucher_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.vouchers v
    where v.wallet_id = new.wallet_id
      and v.id <> new.id
      and lower(btrim(v.code)) = lower(btrim(new.code))
  ) then
    raise exception 'A voucher with this code already exists in this wallet.';
  end if;

  return new;
end;
$$;

drop trigger if exists vouchers_prevent_duplicate_code on public.vouchers;

create trigger vouchers_prevent_duplicate_code
  before insert or update of wallet_id, code
  on public.vouchers
  for each row
  execute function public.prevent_duplicate_voucher_code();
