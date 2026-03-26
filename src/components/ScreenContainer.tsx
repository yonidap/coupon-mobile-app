import { type ReactElement, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenContainerProps = {
  children: ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
};

export function ScreenContainer({ children, scrollable = true, contentContainerStyle, refreshControl }: ScreenContainerProps) {
  if (scrollable) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={[styles.content, contentContainerStyle]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 16,
    gap: 16,
  },
});