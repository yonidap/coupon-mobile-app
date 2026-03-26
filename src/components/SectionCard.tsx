import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#d9e5e0',
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18231e',
  },
  subtitle: {
    color: '#556760',
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    gap: 12,
  },
});