import { StyleSheet, Text, View } from 'react-native';

import { premiumTheme } from '../../theme/premium';

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
    borderRadius: premiumTheme.radius.xl,
    padding: premiumTheme.spacing.lg,
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: premiumTheme.colors.text,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: premiumTheme.colors.muted,
  },
});
