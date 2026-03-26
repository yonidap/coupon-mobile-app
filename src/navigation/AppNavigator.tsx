import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthSessionContext } from '../providers/AuthSessionProvider';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { VoucherDetailsScreen } from '../screens/VoucherDetailsScreen';
import { VoucherFormScreen } from '../screens/VoucherFormScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { isLoading, session } = useAuthSessionContext();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isLoading ? (
          <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        ) : session ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Vouchers' }} />
            <Stack.Screen name="VoucherDetails" component={VoucherDetailsScreen} options={{ title: 'Voucher details' }} />
            <Stack.Screen
              name="VoucherForm"
              component={VoucherFormScreen}
              options={({ route }) => ({ title: route.params?.voucherId ? 'Edit voucher' : 'Create voucher' })}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}