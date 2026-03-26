import Constants from 'expo-constants';
import { z } from 'zod';

const extraSchema = z.object({
  supabaseUrl: z.string().trim().optional().default(''),
  supabaseAnonKey: z.string().trim().optional().default(''),
});

const requiredEnvSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
});

const parsedExtra = extraSchema.parse(Constants.expoConfig?.extra ?? {});

export const env = {
  supabaseUrl: parsedExtra.supabaseUrl,
  supabaseAnonKey: parsedExtra.supabaseAnonKey,
  easProjectId: Constants.easConfig?.projectId ?? '',
};

export const envValidation = requiredEnvSchema.safeParse({
  supabaseUrl: env.supabaseUrl,
  supabaseAnonKey: env.supabaseAnonKey,
});

export const isSupabaseConfigured = envValidation.success;

export function assertSupabaseEnv(): void {
  if (!envValidation.success) {
    throw new Error('Supabase environment variables are missing. Copy .env.example to .env and fill in the Expo public Supabase values.');
  }
}