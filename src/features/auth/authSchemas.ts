import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().optional().default(''),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;