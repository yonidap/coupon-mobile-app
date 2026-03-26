import { maybeGetSupabaseClient } from '../lib/supabase';
import { isMissingRelationError } from '../utils/supabase';

export type RegisterPushTokenInput = {
  userId: string;
  expoPushToken: string;
  platform: string;
  deviceName: string | null;
};

export const notificationsRepository = {
  async registerDevicePushToken(input: RegisterPushTokenInput): Promise<void> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return;
    }

    const { error } = await client.from('push_tokens').upsert({
      user_id: input.userId,
      expo_push_token: input.expoPushToken,
      device_platform: input.platform,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (isMissingRelationError(error)) {
        return;
      }

      throw new Error(error.message);
    }
  },
};