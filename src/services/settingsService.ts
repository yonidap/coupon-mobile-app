import { DEFAULT_CURRENCY, DEFAULT_LANGUAGE, DEFAULT_REMINDER_OFFSETS_DAYS } from '../features/settings/defaults';
import { profilesService } from './profilesService';

export type SettingsScaffoldState = {
  notificationsEnabled: boolean;
  defaultReminderOffsetsDays: string;
  defaultCurrency: string;
  language: string;
};

function parseReminderOffsets(value: string): number[] {
  const offsets = value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 365);

  const uniqueSorted = [...new Set(offsets)].sort((left, right) => right - left);

  if (uniqueSorted.length === 0) {
    throw new Error('Reminder offsets must contain at least one whole number between 0 and 365.');
  }

  return uniqueSorted;
}

function parseCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error('Currency must be a 3-letter code like ILS or USD.');
  }

  return normalized;
}

export const settingsService = {
  async getSettings(userId: string): Promise<SettingsScaffoldState> {
    const profile = await profilesService.getProfile(userId);

    return {
      notificationsEnabled: profile.notificationsEnabled,
      defaultReminderOffsetsDays: (profile.defaultReminderOffsets.length ? profile.defaultReminderOffsets : DEFAULT_REMINDER_OFFSETS_DAYS).join(', '),
      defaultCurrency: profile.defaultCurrency || DEFAULT_CURRENCY,
      language: profile.language || DEFAULT_LANGUAGE,
    };
  },

  async saveSettings(userId: string, input: SettingsScaffoldState): Promise<SettingsScaffoldState> {
    const currentProfile = await profilesService.getProfile(userId);
    const defaultReminderOffsets = parseReminderOffsets(input.defaultReminderOffsetsDays);
    const defaultCurrency = parseCurrency(input.defaultCurrency);
    const language = input.language.trim().toLowerCase() || DEFAULT_LANGUAGE;

    const profile = await profilesService.upsertProfile({
      id: userId,
      displayName: currentProfile.displayName,
      defaultCurrency,
      language,
      notificationsEnabled: input.notificationsEnabled,
      defaultReminderOffsets,
    });

    return {
      notificationsEnabled: profile.notificationsEnabled,
      defaultReminderOffsetsDays: profile.defaultReminderOffsets.join(', '),
      defaultCurrency: profile.defaultCurrency,
      language: profile.language,
    };
  },
};