-- =============================================================================
-- Migration: 20260327000004_voucher_type_split
-- Purpose:   Split vouchers into explicit monetary/product models while
--            keeping existing rows backward compatible.
-- =============================================================================

alter table public.vouchers
  add column if not exists voucher_type text not null default 'monetary'
    check (voucher_type in ('monetary', 'product')),
  add column if not exists product_name text,
  add column if not exists used_value numeric(12, 2) not null default 0
    check (used_value >= 0);

comment on column public.vouchers.voucher_type is
  'Voucher model type: monetary (balance-based) or product (specific item/service).';

comment on column public.vouchers.product_name is
  'Product/service name used when voucher_type = product.';

comment on column public.vouchers.used_value is
  'Amount already used for monetary vouchers. Remaining value is derived in app logic.';

-- Backfill safety for pre-existing rows.
update public.vouchers
set voucher_type = coalesce(voucher_type, 'monetary'),
    used_value = coalesce(used_value, 0)
where voucher_type is null
   or used_value is null;