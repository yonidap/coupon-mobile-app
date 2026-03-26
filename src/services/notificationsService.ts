import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { env } from '../lib/env';
import { notificationsRepository } from '../repositories/notificationsRepository';
import type { NotificationRegistrationResult } from '../types/domain';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const notificationsService = {
  async requestPermissionAndRegister(userId: string): Promise<NotificationRegistrationResult> {
    const currentPermissions = await Notifications.getPermissionsAsync();
    let status = currentPermissions.status;

    if (status !== 'granted') {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      status = requestedPermissions.status;
    }

    if (status !== 'granted') {
      return {
        status: 'denied',
        message: 'Notification permission was not granted.',
      };
    }

    if (!Device.isDevice) {
      return {
        status: 'unavailable',
        message: 'Push token registration requires a physical device.',
      };
    }

    if (!env.easProjectId) {
      return {
        status: 'unavailable',
        message: 'EAS project ID is not available. Build credentials are required before registering Expo push tokens.',
      };
    }

    const expoPushToken = await Notifications.getExpoPushTokenAsync({ projectId: env.easProjectId });

    await notificationsRepository.registerDevicePushToken({
      userId,
      expoPushToken: expoPushToken.data,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? null,
    });

    return {
      status: 'registered',
      token: expoPushToken.data,
      message: 'Push token captured and ready for server-side reminder scheduling.',
    };
  },
};