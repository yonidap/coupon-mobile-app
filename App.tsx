import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppProviders } from './src/providers/AppProviders';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppProviders>
        <StatusBar style="dark" />
        <AppNavigator />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
