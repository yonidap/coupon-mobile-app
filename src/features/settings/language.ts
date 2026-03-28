import { DEFAULT_LANGUAGE } from './defaults';

export const SUPPORTED_LANGUAGE_CODES = ['en', 'he'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGE_CODES)[number];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  he: 'Hebrew',
  en: 'English',
};

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  const normalized = (value ?? '').trim().toLowerCase();

  if (normalized === 'he' || normalized === 'en') {
    return normalized;
  }

  return DEFAULT_LANGUAGE;
}

export function getLanguageLabel(language: SupportedLanguage): string {
  return LANGUAGE_LABELS[language];
}
