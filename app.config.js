const appName = 'Coupon Wallet';

module.exports = {
  expo: {
    name: appName,
    slug: 'coupon-mobile-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#f5efe6',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yonidap.couponmanager",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#f5efe6',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
      projectId: "1d8f808a-2dc9-4c7f-9569-3f8d5652ca00",
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    plugins: ['expo-secure-store', 'expo-notifications'],
  },
};
