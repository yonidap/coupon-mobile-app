const appName = 'Coupon Wallet';
const appShortName = 'Coupons';
const appThemeColor = '#8a6427';
const appBackgroundColor = '#f5efe6';

module.exports = {
  expo: {
    name: appName,
    slug: 'coupon-mobile-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    backgroundColor: appBackgroundColor,
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
      name: appName,
      shortName: appShortName,
      lang: 'en',
      scope: '/',
      startUrl: '/',
      display: 'standalone',
      orientation: 'portrait',
      themeColor: appThemeColor,
      backgroundColor: appBackgroundColor,
      barStyle: 'default',
      description: 'Track coupons and vouchers in one place.',
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
