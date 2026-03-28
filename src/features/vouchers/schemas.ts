import { z } from 'zod';

import { voucherCategories } from './categories';

const optionalText = z.string().trim();
function normalizeNumericText(value: string): string {
  return value.trim().replace(',', '.');
}

const optionalNumericText = z
  .string()
  .trim()
  .refine((value) => value === '' || !Number.isNaN(Number(normalizeNumericText(value))), 'Enter a valid number.');

const attachmentSchema = z.object({
  localUri: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
});

export const voucherCreateSchema = z.object({
  voucherType: z.enum(['monetary', 'product']),
  category: z.enum(voucherCategories),
  productName: optionalText,
  merchantName: optionalText,
  faceValue: optionalNumericText,
  usedValue: optionalNumericText,
  currency: z
    .string()
    .trim()
    .length(3, 'Currency code must be 3 letters.')
    .transform((value) => value.toUpperCase()),
  purchaseDate: optionalText.refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date must use YYYY-MM-DD.'),
  expiryDate: z
    .string()
    .trim()
    .min(1, 'Expiry date is required.')
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date must use YYYY-MM-DD.'),
  code: optionalText,
  notes: optionalText,
  attachment: attachmentSchema.optional(),
}).superRefine((values, ctx) => {
  if (!values.merchantName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['merchantName'],
      message: 'Merchant name is required.',
    });
  }

  if (values.voucherType === 'monetary') {
    if (!values.faceValue.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['faceValue'],
        message: 'Face value is required for a monetary voucher.',
      });
    }
  }

  if (values.voucherType === 'product' && !values.productName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['productName'],
      message: 'Product name is required for a product voucher.',
    });
  }
});

export const voucherUpdateSchema = voucherCreateSchema;

export type VoucherFormValues = z.infer<typeof voucherCreateSchema>;
