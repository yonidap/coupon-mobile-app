import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';

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

  return (
    <AppLanguageProvider language={currentLanguage}>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: premiumTheme.colors.backgroundSoft,
            },
            headerTitleStyle: {
              color: premiumTheme.colors.text,
              fontWeight: '800',
            },
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
                  title: copy.navigation.wallet,
                  headerRight: () => (
                    <View style={{ marginRight: 12 }}>
                      <TopBarMenu
                        currentLanguage={currentLanguage}
                        onLanguageChange={handleLanguageChange}
                        onSettings={() => navigation.navigate('Settings')}
                        onSignOut={() => authService.signOut()}
                      />
                    </View>
                  ),
                })}
              />
              <Stack.Screen
                name="VoucherDetails"
                component={VoucherDetailsScreen}
                options={({ navigation }) => ({
                  title: copy.navigation.details,
                  headerRight: () => (
                    <View style={{ marginRight: 12 }}>
                      <TopBarMenu
                        currentLanguage={currentLanguage}
                        onLanguageChange={handleLanguageChange}
                        onSettings={() => navigation.navigate('Settings')}
                        onSignOut={() => authService.signOut()}
                      />
                    </View>
                  ),
                })}
              />
              <Stack.Screen
                name="VoucherCreateEntry"
                component={VoucherCreateEntryScreen}
                options={({ navigation }) => ({
                  title: copy.home.addVoucher,
                  headerRight: () => (
                    <View style={{ marginRight: 12 }}>
                      <TopBarMenu
                        currentLanguage={currentLanguage}
                        onLanguageChange={handleLanguageChange}
                        onSettings={() => navigation.navigate('Settings')}
                        onSignOut={() => authService.signOut()}
                      />
                    </View>
                  ),
                })}
              />
              <Stack.Screen
                name="VoucherForm"
                component={VoucherFormScreen}
                options={({ navigation }) => ({
                  title: copy.navigation.voucher,
                  headerRight: () => (
                    <View style={{ marginRight: 12 }}>
                      <TopBarMenu
                        currentLanguage={currentLanguage}
                        onLanguageChange={handleLanguageChange}
                        onSettings={() => navigation.navigate('Settings')}
                        onSignOut={() => authService.signOut()}
                      />
                    </View>
                  ),
                })}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={({ navigation }) => ({
                  title: copy.navigation.settings,
                  headerRight: () => (
                    <View style={{ marginRight: 12 }}>
                      <TopBarMenu
                        currentLanguage={currentLanguage}
                        onLanguageChange={handleLanguageChange}
                        showSettings={false}
                        onSettings={() => navigation.navigate('Settings')}
                        onSignOut={() => authService.signOut()}
                      />
                    </View>
                  ),
                })}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ title: copy.navigation.access }} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ title: copy.navigation.access }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AppLanguageProvider>
  );
}
