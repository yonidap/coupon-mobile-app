-- Migration: 20260328000005_voucher_categories
-- Purpose: Constrain voucher categories to the preset list used by the app.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vouchers_category_check'
      and conrelid = 'public.vouchers'::regclass
  ) then
    update public.vouchers
      set category = 'Other'
      where category = 'Services';

    alter table public.vouchers
      add constraint vouchers_category_check
      check (
        category is null
        or category in (
          'Groceries',
          'Dining',
          'Shopping',
          'Travel',
          'Entertainment',
          'Health & Beauty',
          'Electronics',
          'Home & Garden',
          'Other'
        )
      );
  end if;
end $$;

comment on constraint vouchers_category_check on public.vouchers is
  'Limits voucher.category to the preset categories exposed by the mobile app.';
