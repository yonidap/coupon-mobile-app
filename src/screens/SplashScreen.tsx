import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { premiumTheme } from '../theme/premium';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.orbLarge} />
      <View style={styles.orbSmall} />
      <ActivityIndicator size="large" color={premiumTheme.colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.background,
    padding: 24,
    gap: 12,
    overflow: 'hidden',
  },
  orbLarge: {
    position: 'absolute',
    top: -110,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(138, 100, 39, 0.14)',
  },
  orbSmall: {
    position: 'absolute',
    left: -60,
    bottom: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(54, 93, 156, 0.1)',
  },
});
