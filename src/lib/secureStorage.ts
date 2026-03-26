import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const storageKeyPrefix = 'coupon-wallet:';

function buildStorageKey(key: string): string {
  return `${storageKeyPrefix}${key}`;
}

export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const storageKey = buildStorageKey(key);

    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(storageKey);
    }

    return SecureStore.getItemAsync(storageKey);
  },
  async setItem(key: string, value: string): Promise<void> {
    const storageKey = buildStorageKey(key);

    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(storageKey, value);
      return;
    }

    await SecureStore.setItemAsync(storageKey, value);
  },
  async removeItem(key: string): Promise<void> {
    const storageKey = buildStorageKey(key);

    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(storageKey);
      return;
    }

    await SecureStore.deleteItemAsync(storageKey);
  },
};