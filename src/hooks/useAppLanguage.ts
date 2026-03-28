import { useAppLanguageContext } from '../providers/AppLanguageProvider';

export function useAppLanguage() {
  return useAppLanguageContext();
}
