import { useAuthSessionContext } from '../providers/AuthSessionProvider';

export function useAuthSession() {
  return useAuthSessionContext();
}