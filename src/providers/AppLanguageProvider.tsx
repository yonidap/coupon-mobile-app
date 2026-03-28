import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LANGUAGE } from '../features/settings/defaults';
import type { SupportedLanguage } from '../features/settings/language';
import { getCopy, getLocaleForLanguage, type AppCopy } from '../i18n/translations';

type AppLanguageContextValue = {
  language: SupportedLanguage;
  copy: AppCopy;
  locale: string;
  isRtl: boolean;
};

const AppLanguageContext = createContext<AppLanguageContextValue | undefined>(undefined);

type AppLanguageProviderProps = {
  language?: SupportedLanguage | null;
  children: ReactNode;
};

export function AppLanguageProvider({ language, children }: AppLanguageProviderProps) {
  const activeLanguage = language ?? DEFAULT_LANGUAGE;

  const value = useMemo<AppLanguageContextValue>(
    () => ({
      language: activeLanguage,
      copy: getCopy(activeLanguage),
      locale: getLocaleForLanguage(activeLanguage),
      isRtl: activeLanguage === 'he',
    }),
    [activeLanguage],
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguageContext(): AppLanguageContextValue {
  const context = useContext(AppLanguageContext);

  if (!context) {
    throw new Error('useAppLanguageContext must be used inside AppLanguageProvider.');
  }

  return context;
}
