import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { authService } from '../services/authService';
import { isSupabaseConfigured } from '../lib/env';
import { notificationsService } from '../services/notificationsService';
import { profilesService } from '../services/profilesService';

type AuthSessionContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastPushRegistrationUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    authService
      .getSession()
      .then((nextSession) => {
        if (isMounted) {
          setSession(nextSession);
        }
      })
      .catch((nextError) => {
        if (isMounted) {
          setError(nextError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const subscription = authService.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId || lastPushRegistrationUserIdRef.current === userId) {
      return;
    }

    let isMounted = true;

    const registerPushToken = async () => {
      try {
        const profile = await profilesService.getProfile(userId);

        if (!profile.notificationsEnabled) {
          return;
        }

        await notificationsService.requestPermissionAndRegister(userId);
      } catch (nextError) {
        if (isMounted) {
          const message = nextError instanceof Error ? nextError.message : 'Failed to register push token.';
          console.warn(message);
        }
      } finally {
        if (isMounted) {
          lastPushRegistrationUserIdRef.current = userId;
        }
      }
    };

    registerPushToken();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isConfigured: isSupabaseConfigured,
      error,
    }),
    [error, isLoading, session],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSessionContext(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSessionContext must be used inside AuthSessionProvider.');
  }

  return context;
}