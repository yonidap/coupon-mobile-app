import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { FormTextField } from '../components/FormTextField';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { useAuthSession } from '../hooks/useAuthSession';
import { authService } from '../services/authService';
import { notificationsService } from '../services/notificationsService';
import { settingsService, type SettingsScaffoldState } from '../services/settingsService';

const defaultState: SettingsScaffoldState = {
  notificationsEnabled: true,
  defaultReminderOffsetsDays: '30, 7, 1',
  defaultCurrency: 'ILS',
  language: 'he',
};

export function SettingsScreen() {
  const { user } = useAuthSession();
  const [settings, setSettings] = useState<SettingsScaffoldState>(defaultState);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['settings', user?.id],
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
      Alert.alert('Settings saved', 'Your defaults have been updated.');
    } catch {
      Alert.alert('Save failed', 'Please use valid reminder offsets and a 3-letter currency code.');
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
      setPushStatus(result.message ?? result.status);
    } catch {
      setPushStatus('Push registration failed. Please try again.');
    }
  }

  async function handleLogout() {
    try {
      await authService.signOut();
    } catch {
      Alert.alert('Sign out failed', 'Unable to sign out right now. Please try again.');
    }
  }

  return (
    <ScreenContainer>
      {settingsQuery.isLoading ? <ActivityIndicator color="#1f5f4d" /> : null}
      <SectionCard title="Notifications" subtitle="Reminder scheduling should remain server-side. This screen only captures permission state and the Expo push token scaffold.">
        <View style={styles.switchRow}>
          <Text style={styles.label}>Notifications enabled</Text>
          <Switch value={settings.notificationsEnabled} onValueChange={(value) => setSettings((current) => ({ ...current, notificationsEnabled: value }))} />
        </View>
        <FormTextField
          label="Default reminder offsets"
          value={settings.defaultReminderOffsetsDays}
          onChangeText={(value) => setSettings((current) => ({ ...current, defaultReminderOffsetsDays: value }))}
          placeholder="30, 7, 1"
        />
        <Pressable style={styles.secondaryButton} onPress={handlePushRegistration}>
          <Text style={styles.secondaryButtonText}>Register Expo push token</Text>
        </Pressable>
        {pushStatus ? <Text style={styles.statusText}>{pushStatus}</Text> : null}
      </SectionCard>

      <SectionCard title="Defaults" subtitle="Profile-linked defaults are scaffolded here to keep currency and locale concerns out of screen components.">
        <FormTextField
          label="Default currency"
          value={settings.defaultCurrency}
          onChangeText={(value) => setSettings((current) => ({ ...current, defaultCurrency: value.toUpperCase() }))}
          placeholder="USD"
          autoCapitalize="characters"
        />
        <FormTextField
          label="Language"
          value={settings.language}
          onChangeText={(value) => setSettings((current) => ({ ...current, language: value }))}
          placeholder="en"
          autoCapitalize="none"
        />
      </SectionCard>

      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={isSaving}>
        <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save settings'}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={handleLogout}>
        <Text style={styles.secondaryButtonText}>Log out</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#18231e',
    flex: 1,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f5f4d',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7efeb',
  },
  secondaryButtonText: {
    color: '#173029',
    fontWeight: '700',
  },
  statusText: {
    color: '#556760',
    fontSize: 14,
    lineHeight: 20,
  },
});