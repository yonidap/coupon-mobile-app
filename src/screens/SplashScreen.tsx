import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coupon Wallet</Text>
      <Text style={styles.subtitle}>Bootstrapping secure session state...</Text>
      <ActivityIndicator size="large" color="#1f5f4d" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f7f6',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#17231f',
  },
  subtitle: {
    fontSize: 15,
    color: '#556760',
  },
});