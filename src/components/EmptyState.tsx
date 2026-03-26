import { StyleSheet, Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#b9cbc5',
    backgroundColor: '#f9fbfa',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1b2723',
  },
  message: {
    fontSize: 14,
    color: '#556760',
    lineHeight: 20,
  },
});