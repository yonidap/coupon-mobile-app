import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { getSupabaseClient, maybeGetSupabaseClient } from '../lib/supabase';

export type AuthCredentials = {
  email: string;
  password: string;
};

export type RegisterInput = AuthCredentials & {
  displayName?: string;
};

const noopSubscription = {
  unsubscribe() {},
};

export const authRepository = {
  async signIn(credentials: AuthCredentials): Promise<Session | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword(credentials);

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  },

  async signUp({ email, password, displayName }: RegisterInput): Promise<Session | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName ?? '',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  },

  async signOut(): Promise<void> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  },

  async getSession(): Promise<Session | null> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return null;
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return noopSubscription;
    }

    const { data } = client.auth.onAuthStateChange(callback);
    return data.subscription;
  },
};