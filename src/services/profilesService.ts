import { profilesRepository } from '../repositories/profilesRepository';
import type { SupportedLanguage } from '../features/settings/language';

export const profilesService = {
  async getProfile(userId: string) {
    return profilesRepository.getByUserId(userId);
  },

  async upsertProfile(input: {
    id: string;
    displayName: string | null;
    defaultCurrency: string;
    language: SupportedLanguage;
    timezone?: string;
    notificationsEnabled?: boolean;
    defaultReminderOffsets?: number[];
  }) {
    return profilesRepository.upsert(input);
  },
};
