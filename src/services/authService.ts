import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { authRepository, type AuthCredentials, type RegisterInput } from '../repositories/authRepository';
import { profilesService } from './profilesService';
import { walletsService } from './walletsService';

export const authService = {
  async signIn(credentials: AuthCredentials): Promise<Session | null> {
    return authRepository.signIn(credentials);
  },

  async signUp(input: RegisterInput): Promise<Session | null> {
    const session = await authRepository.signUp(input);

    if (session?.user) {
      await profilesService.upsertProfile({
        id: session.user.id,
        displayName: input.displayName ?? null,
        defaultCurrency: 'ILS',
        language: 'he',
        defaultReminderOffsets: [30, 7, 1],
      });

      try {
        await walletsService.getActiveWallet(session.user.id);
      } catch {
        throw new Error('Account created, but personal wallet setup is incomplete. Please sign out and sign in again.');
      }
    }

    return session;
  },

  async signOut(): Promise<void> {
    await authRepository.signOut();
  },

  async getSession(): Promise<Session | null> {
    return authRepository.getSession();
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return authRepository.onAuthStateChange(callback);
  },
};