import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Creates a Supabase client authenticated as service_role.
 *
 * service_role bypasses Row Level Security (RLS), which is required for the
 * reminder job to read vouchers, wallet members, and push tokens owned by
 * different users without impersonating any individual user session.
 *
 * SECURITY NOTES
 * ──────────────
 * • SUPABASE_SERVICE_ROLE_KEY must NEVER be exposed to mobile clients.
 * • This function must only be called inside Supabase Edge Functions.
 * • SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
 *   by the Supabase runtime; no manual .env configuration is required for
 *   these two variables when deployed.
 */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
        'These are injected automatically by the Supabase Edge Function runtime.',
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      // Disable token auto-refresh and session persistence — not applicable
      // in a stateless server function context.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
