import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { FormTextField } from '../components/FormTextField';
import { LanguageSlider } from '../components/LanguageSlider';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { DEFAULT_LANGUAGE } from '../features/settings/defaults';
import { useAuthSession } from '../hooks/useAuthSession';
import { useAppLanguage } from '../hooks/useAppLanguage';
import { translateKnownMessage } from '../i18n/translations';
import { authService } from '../services/authService';
import { notificationsService } from '../services/notificationsService';
import { settingsKeys, settingsService, type SettingsScaffoldState } from '../services/settingsService';
import { premiumTheme } from '../theme/premium';

const defaultState: SettingsScaffoldState = {
  notificationsEnabled: true,
  defaultReminderOffsetsDays: '30, 7, 1',
  defaultCurrency: 'ILS',
  language: DEFAULT_LANGUAGE,
};

export function SettingsScreen() {
  const { user } = useAuthSession();
  const { copy, language, isRtl } = useAppLanguage();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SettingsScaffoldState>(defaultState);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const settingsQuery = useQuery({
    queryKey: user?.id ? settingsKeys.detail(user.id) : settingsKeys.all,
    enabled: Boolean(user),
    queryFn: async () => settingsService.getSettings(user?.id as string),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  async function handleSave() {
    if (!user) {
      return;
    }

    try {
      setIsSaving(true);
      const saved = await settingsService.saveSettings(user.id, settings);
      setSettings(saved);
      await queryClient.invalidateQueries({ queryKey: settingsKeys.detail(user.id) });
      Alert.alert(copy.settings.settingsSavedTitle, copy.settings.settingsSavedMessage);
    } catch (error) {
      console.error('[SettingsScreen] Save settings failed:', error);
      const message = error instanceof Error ? translateKnownMessage(error.message, language) : copy.settings.saveFailedMessage;
      Alert.alert(copy.settings.saveFailedTitle, message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePushRegistration() {
    if (!user) {
      return;
    }

    try {
      const result = await notificationsService.requestPermissionAndRegister(user.id);
      setPushStatus(result.message ? translateKnownMessage(result.message, language) : result.status);
    } catch (error) {
      console.error('[SettingsScreen] Push token registration failed:', error);
      setPushStatus(copy.settings.pushRegistrationFailed);
    }
  }

  async function handleLogout() {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('[SettingsScreen] Sign out failed:', error);
      Alert.alert(copy.settings.signOutFailedTitle, copy.settings.signOutFailedMessage);
    }
  }

  return (
    <ScreenContainer>
      {settingsQuery.isLoading ? <ActivityIndicator color={premiumTheme.colors.accent} /> : null}
      <SectionCard>
        <View style={[styles.switchRow, isRtl ? styles.rowReverse : null]}>
          <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.settings.notificationsEnabled}</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(value) => setSettings((current) => ({ ...current, notificationsEnabled: value }))}
            trackColor={{ false: premiumTheme.colors.border, true: premiumTheme.colors.accentSoft }}
            thumbColor={settings.notificationsEnabled ? premiumTheme.colors.accent : '#f8f3eb'}
          />
        </View>
        <FormTextField
          label={copy.settings.defaultReminderOffsets}
          value={settings.defaultReminderOffsetsDays}
          onChangeText={(value) => setSettings((current) => ({ ...current, defaultReminderOffsetsDays: value }))}
          placeholder="30, 7, 1"
        />
        <Pressable style={styles.secondaryButton} onPress={handlePushRegistration}>
          <Text style={styles.secondaryButtonText}>{copy.settings.registerPushToken}</Text>
        </Pressable>
        {pushStatus ? <Text style={[styles.statusText, isRtl ? styles.textRtl : null]}>{pushStatus}</Text> : null}
      </SectionCard>

      <SectionCard>
        <FormTextField
          label={copy.settings.defaultCurrency}
          value={settings.defaultCurrency}
          onChangeText={(value) => setSettings((current) => ({ ...current, defaultCurrency: value.toUpperCase() }))}
          placeholder="USD"
          autoCapitalize="characters"
        />
        <View style={[styles.languageBlock, isRtl ? styles.languageBlockRtl : null]}>
          <Text style={[styles.languageLabel, isRtl ? styles.textRtl : null]}>{copy.settings.language}</Text>
          <Text style={[styles.languageHelp, isRtl ? styles.textRtl : null]}>{copy.settings.languageHelp}</Text>
          <LanguageSlider value={settings.language} onChange={(language) => setSettings((current) => ({ ...current, language }))} />
        </View>
      </SectionCard>

      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={isSaving}>
        <Text style={styles.primaryButtonText}>{isSaving ? copy.common.saving : copy.settings.saveSettings}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={handleLogout}>
        <Text style={styles.secondaryButtonText}>{copy.settings.logOut}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: premiumTheme.radius.lg,
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: premiumTheme.colors.text,
    flex: 1,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.accent,
    borderWidth: 1,
    borderColor: premiumTheme.colors.accentStrong,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryButtonText: {
    color: premiumTheme.colors.surfaceStrong,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  secondaryButtonText: {
    color: premiumTheme.colors.mutedStrong,
    fontWeight: '800',
  },
  statusText: {
    color: premiumTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  languageBlock: {
    gap: 10,
  },
  languageBlockRtl: {
    alignItems: 'flex-end',
  },
  languageLabel: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  languageHelp: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
