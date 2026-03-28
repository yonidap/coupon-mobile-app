export const voucherCategories = [
  'Groceries',
  'Dining',
  'Shopping',
  'Travel',
  'Entertainment',
  'Health & Beauty',
  'Electronics',
  'Home & Garden',
  'Other',
] as const;

export type VoucherCategory = (typeof voucherCategories)[number];

export const defaultVoucherCategory: VoucherCategory = voucherCategories[voucherCategories.length - 1];
