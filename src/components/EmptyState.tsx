import { StyleSheet, Text, View } from 'react-native';

import { useAppLanguage } from '../hooks/useAppLanguage';
import { premiumTheme } from '../theme/premium';

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  const { isRtl } = useAppLanguage();

  return (
    <View style={[styles.container, isRtl ? styles.containerRtl : null]}>
      <Text style={[styles.title, isRtl ? styles.textRtl : null]}>{title}</Text>
      <Text style={[styles.message, isRtl ? styles.textRtl : null]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: premiumTheme.spacing.lg,
    borderRadius: premiumTheme.radius.xl,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceTint,
    gap: 8,
  },
  containerRtl: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: premiumTheme.colors.text,
  },
  message: {
    fontSize: 14,
    color: premiumTheme.colors.muted,
    lineHeight: 20,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
