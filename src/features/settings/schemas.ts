import { z } from 'zod';

const reminderOffsetTokenSchema = z
  .string()
  .trim()
  .refine((value) => /^\d+$/.test(value), 'Reminder offsets must be whole numbers between 0 and 365.')
  .transform((value) => Number(value))
  .refine((value) => value >= 0 && value <= 365, 'Reminder offsets must be whole numbers between 0 and 365.');

export const reminderOffsetsInputSchema = z
  .string()
  .trim()
  .min(1, 'Reminder offsets must contain at least one whole number between 0 and 365.')
  .transform((value, ctx) => {
    const offsets: number[] = [];

    for (const rawToken of value.split(',')) {
      const token = rawToken.trim();

      if (!token) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Reminder offsets must be comma-separated whole numbers between 0 and 365.',
        });
        return z.NEVER;
      }

      const parsedToken = reminderOffsetTokenSchema.safeParse(token);

      if (!parsedToken.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            parsedToken.error.issues[0]?.message ??
            'Reminder offsets must be whole numbers between 0 and 365.',
        });
        return z.NEVER;
      }

      offsets.push(parsedToken.data);
    }

    return [...new Set(offsets)].sort((left, right) => right - left);
  });

export function parseReminderOffsets(value: string): number[] {
  return reminderOffsetsInputSchema.parse(value);
}

export function formatReminderOffsets(offsets: number[]): string {
  return offsets.join(', ');
}
