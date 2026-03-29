import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image, Pressable, View } from 'react-native';

import { TopBarMenu } from '../components/TopBarMenu';
import { DEFAULT_LANGUAGE } from '../features/settings/defaults';
import { type SupportedLanguage } from '../features/settings/language';
import { getCopy } from '../i18n/translations';
import { AppLanguageProvider } from '../providers/AppLanguageProvider';
import { settingsKeys, settingsService } from '../services/settingsService';
import { useAuthSessionContext } from '../providers/AuthSessionProvider';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { VoucherCreateEntryScreen } from '../screens/VoucherCreateEntryScreen';
import { VoucherDetailsScreen } from '../screens/VoucherDetailsScreen';
import { VoucherFormScreen } from '../screens/VoucherFormScreen';
import { authService } from '../services/authService';
import { premiumTheme } from '../theme/premium';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: premiumTheme.colors.background,
    card: premiumTheme.colors.surface,
    text: premiumTheme.colors.text,
    border: premiumTheme.colors.border,
    primary: premiumTheme.colors.accent,
    notification: premiumTheme.colors.accent,
  },
};

type HeaderNavigation = {
  navigate: (screen: 'Home' | 'Settings') => void;
};

export function AppNavigator() {
  const { isLoading, session } = useAuthSessionContext();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const settingsQuery = useQuery({
    queryKey: userId ? settingsKeys.detail(userId) : settingsKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => settingsService.getSettings(userId as string),
  });

  const currentLanguage = settingsQuery.data?.language ?? DEFAULT_LANGUAGE;
  const copy = getCopy(currentLanguage);

  async function handleLanguageChange(language: SupportedLanguage) {
    if (!userId) {
      return;
    }

    await settingsService.updateLanguage(userId, language);
    await queryClient.invalidateQueries({ queryKey: settingsKeys.detail(userId) });
  }

  function goHome(navigation: HeaderNavigation) {
    navigation.navigate('Home');
  }

  function renderHeaderRight(navigation: HeaderNavigation, showSettings = true) {
    return (
      <View style={{ marginRight: 12 }}>
        <TopBarMenu
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
          onHome={() => goHome(navigation)}
          onSettings={() => navigation.navigate('Settings')}
          onSignOut={() => authService.signOut()}
          showSettings={showSettings}
        />
      </View>
    );
  }

  function renderHeaderLogo(navigation: HeaderNavigation) {
    return (
      <Pressable
        accessibilityLabel={copy.menu.overview}
        accessibilityRole="button"
        onPress={() => goHome(navigation)}
        style={({ pressed }) => [styles.headerLogoSlot, pressed ? styles.headerLogoPressed : null]}
        hitSlop={10}
      >
        <Image source={require('../../assets/icon.png')} style={styles.headerLogo} resizeMode="contain" />
      </Pressable>
    );
  }

  return (
    <AppLanguageProvider language={currentLanguage}>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: premiumTheme.colors.backgroundSoft,
            },
            headerTitle: () => null,
            headerTitleStyle: {
              color: premiumTheme.colors.text,
              fontWeight: '800',
            },
            headerBackTitleVisible: false,
            headerTintColor: premiumTheme.colors.accent,
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: premiumTheme.colors.background,
            },
            animation: 'slide_from_right',
          }}
        >
          {isLoading ? (
            <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
          ) : session ? (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={({ navigation }) => ({
                  headerLeft: () => renderHeaderLogo(navigation),
                  headerRight: () => renderHeaderRight(navigation),
                })}
              />
              <Stack.Screen
                name="VoucherDetails"
                component={VoucherDetailsScreen}
                options={({ navigation }) => ({
                  headerLeft: () => renderHeaderLogo(navigation),
                  headerRight: () => renderHeaderRight(navigation),
                })}
              />
              <Stack.Screen
                name="VoucherCreateEntry"
                component={VoucherCreateEntryScreen}
                options={({ navigation }) => ({
                  headerLeft: () => renderHeaderLogo(navigation),
                  headerRight: () => renderHeaderRight(navigation),
                })}
              />
              <Stack.Screen
                name="VoucherForm"
                component={VoucherFormScreen}
                options={({ navigation }) => ({
                  headerLeft: () => renderHeaderLogo(navigation),
                  headerRight: () => renderHeaderRight(navigation),
                })}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={({ navigation }) => ({
                  headerLeft: () => renderHeaderLogo(navigation),
                  headerRight: () => renderHeaderRight(navigation, false),
                })}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AppLanguageProvider>
  );
}

const styles = {
  headerLogoSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 12,
  },
  headerLogoPressed: {
    opacity: 0.75,
  },
  headerLogo: {
    width: 44,
    height: 44,
  },
} as const;
