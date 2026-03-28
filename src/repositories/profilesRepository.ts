import type { Profile } from '../types/domain';
import { maybeGetSupabaseClient, getSupabaseClient } from '../lib/supabase';
import { isMissingRelationError } from '../utils/supabase';
import { getDeviceTimeZone } from '../utils/timezone';
import { DEFAULT_LANGUAGE } from '../features/settings/defaults';
import { normalizeLanguage, type SupportedLanguage } from '../features/settings/language';

type UpsertProfileInput = {
  id: string;
  displayName: string | null;
  defaultCurrency: string;
  language: SupportedLanguage;
  timezone?: string;
  notificationsEnabled?: boolean;
  defaultReminderOffsets?: number[];
};

function mapProfile(row: {
  id: string;
  display_name: string | null;
  default_currency: string;
  language: string;
  timezone?: string | null;
  notifications_enabled: boolean;
  default_reminder_offsets: number[];
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    defaultCurrency: row.default_currency,
    language: normalizeLanguage(row.language),
    timezone: row.timezone ?? 'UTC',
    notificationsEnabled: row.notifications_enabled,
    defaultReminderOffsets: row.default_reminder_offsets,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildFallbackProfile(userId: string): Profile {
  const now = new Date().toISOString();

  return {
    id: userId,
    displayName: null,
    defaultCurrency: 'ILS',
    language: DEFAULT_LANGUAGE,
    timezone: getDeviceTimeZone(),
    notificationsEnabled: true,
    defaultReminderOffsets: [30, 7, 1],
    createdAt: now,
    updatedAt: now,
  };
}

export const profilesRepository = {
  async getByUserId(userId: string): Promise<Profile> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return buildFallbackProfile(userId);
    }

    const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return buildFallbackProfile(userId);
      }

      throw new Error(error.message);
    }

    return data ? mapProfile(data) : buildFallbackProfile(userId);
  },

  async upsert(input: UpsertProfileInput): Promise<Profile> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .upsert({
        id: input.id,
        display_name: input.displayName,
        default_currency: input.defaultCurrency,
        language: input.language,
        timezone: input.timezone ?? getDeviceTimeZone(),
        notifications_enabled: input.notificationsEnabled ?? true,
        default_reminder_offsets: input.defaultReminderOffsets ?? [30, 7, 1],
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapProfile(data);
  },
};
