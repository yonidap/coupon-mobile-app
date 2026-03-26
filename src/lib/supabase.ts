import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured, assertSupabaseEnv } from './env';
import { supabaseAuthStorage } from './secureStorage';
import type { Database } from '../types/database';

let clientInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  assertSupabaseEnv();

  if (!clientInstance) {
    clientInstance = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: supabaseAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return clientInstance;
}

export function maybeGetSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  return getSupabaseClient();
}