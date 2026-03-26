import { z } from 'zod';

const optionalText = z.string().trim();
const optionalNumericText = z.string().trim().refine((value) => value === '' || !Number.isNaN(Number(value)), 'Enter a valid number.');

const attachmentSchema = z.object({
  localUri: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
});

export const voucherCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  merchantName: optionalText,
  category: optionalText,
  faceValue: optionalNumericText,
  paidValue: optionalNumericText,
  currency: z
    .string()
    .trim()
    .length(3, 'Use a 3-letter currency code like USD.')
    .transform((value) => value.toUpperCase()),
  purchaseDate: optionalText.refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use YYYY-MM-DD.'),
  expiryDate: z
    .string()
    .trim()
    .min(1, 'Expiry date is required.')
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use YYYY-MM-DD.'),
  code: optionalText,
  notes: optionalText,
  attachment: attachmentSchema.optional(),
});

export const voucherUpdateSchema = voucherCreateSchema;

export type VoucherFormValues = z.infer<typeof voucherCreateSchema>;