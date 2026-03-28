import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppLanguage } from '../hooks/useAppLanguage';
import { premiumTheme } from '../theme/premium';

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  const { isRtl } = useAppLanguage();

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      {title || subtitle ? (
        <View style={[styles.header, isRtl ? styles.headerRtl : null]}>
          {title ? <Text style={[styles.title, isRtl ? styles.textRtl : null]}>{title}</Text> : null}
          {subtitle ? <Text style={[styles.subtitle, isRtl ? styles.textRtl : null]}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: premiumTheme.radius.xl,
    backgroundColor: premiumTheme.colors.surface,
    padding: premiumTheme.spacing.lg,
    gap: premiumTheme.spacing.md,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: premiumTheme.colors.accent,
  },
  header: {
    gap: 8,
    marginTop: 4,
  },
  headerRtl: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: premiumTheme.colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  content: {
    gap: premiumTheme.spacing.md,
  },
});
