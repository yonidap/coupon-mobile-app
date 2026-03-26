import { profilesRepository } from '../repositories/profilesRepository';

export const profilesService = {
  async getProfile(userId: string) {
    return profilesRepository.getByUserId(userId);
  },

  async upsertProfile(input: {
    id: string;
    displayName: string | null;
    defaultCurrency: string;
    language: string;
    notificationsEnabled?: boolean;
    defaultReminderOffsets?: number[];
  }) {
    return profilesRepository.upsert(input);
  },
};