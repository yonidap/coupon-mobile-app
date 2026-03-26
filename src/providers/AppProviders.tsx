import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../lib/queryClient';
import { AuthSessionProvider } from './AuthSessionProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}