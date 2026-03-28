import { DEFAULT_CURRENCY, DEFAULT_REMINDER_OFFSETS_DAYS } from '../features/settings/defaults';
import { normalizeLanguage, type SupportedLanguage } from '../features/settings/language';
import { formatReminderOffsets, parseReminderOffsets } from '../features/settings/schemas';
import { profilesService } from './profilesService';
import type { Profile } from '../types/domain';

export type SettingsScaffoldState = {
  notificationsEnabled: boolean;
  defaultReminderOffsetsDays: string;
  defaultCurrency: string;
  language: SupportedLanguage;
};

const settingsAllKey = ['settings'] as const;

export const settingsKeys = {
  all: settingsAllKey,
  detail: (userId: string) => [...settingsAllKey, userId] as const,
};

function parseCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error('Currency must be a 3-letter code like ILS or USD.');
  }

  return normalized;
}

function mapProfileToSettings(profile: Profile): SettingsScaffoldState {
  return {
    notificationsEnabled: profile.notificationsEnabled,
    defaultReminderOffsetsDays: formatReminderOffsets(
      profile.defaultReminderOffsets.length ? profile.defaultReminderOffsets : DEFAULT_REMINDER_OFFSETS_DAYS,
    ),
    defaultCurrency: profile.defaultCurrency || DEFAULT_CURRENCY,
    language: normalizeLanguage(profile.language),
  };
}

export const settingsService = {
  async getSettings(userId: string): Promise<SettingsScaffoldState> {
    const profile = await profilesService.getProfile(userId);

    return mapProfileToSettings(profile);
  },

  async saveSettings(userId: string, input: SettingsScaffoldState): Promise<SettingsScaffoldState> {
    const currentProfile = await profilesService.getProfile(userId);
    const defaultReminderOffsets = parseReminderOffsets(input.defaultReminderOffsetsDays);
    const defaultCurrency = parseCurrency(input.defaultCurrency);
    const language = normalizeLanguage(input.language);

    const profile = await profilesService.upsertProfile({
      id: userId,
      displayName: currentProfile.displayName,
      defaultCurrency,
      language,
      timezone: currentProfile.timezone,
      notificationsEnabled: input.notificationsEnabled,
      defaultReminderOffsets,
    });

    return mapProfileToSettings(profile);
  },

  async updateLanguage(userId: string, language: SupportedLanguage): Promise<SettingsScaffoldState> {
    const currentProfile = await profilesService.getProfile(userId);

    const profile = await profilesService.upsertProfile({
      id: userId,
      displayName: currentProfile.displayName,
      defaultCurrency: currentProfile.defaultCurrency,
      language: normalizeLanguage(language),
      timezone: currentProfile.timezone,
      notificationsEnabled: currentProfile.notificationsEnabled,
      defaultReminderOffsets: currentProfile.defaultReminderOffsets,
    });

    return mapProfileToSettings(profile);
  },
};
