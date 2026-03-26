import { StyleSheet, Text, View } from 'react-native';

export function FamilyWalletPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Family wallets are prepared, not enabled.</Text>
      <Text style={styles.message}>
        The data model and repository seams already account for shared wallets, roles, and membership expansion. The MVP UI keeps a personal wallet as the active flow.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#e8f1ed',
    borderWidth: 1,
    borderColor: '#c5d7d0',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f302a',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4c6058',
  },
});