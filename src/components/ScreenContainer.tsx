import { type ReactElement, type ReactNode } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { premiumTheme } from '../theme/premium';

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
        <View pointerEvents="none" style={styles.backgroundLayer}>
          <View style={styles.topGlow} />
          <View style={styles.bottomGlow} />
          <View style={styles.centerOrb} />
        </View>
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
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />
        <View style={styles.centerOrb} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: premiumTheme.colors.background,
  },
  flex: {
    flex: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: -100,
    right: -84,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(138, 100, 39, 0.14)',
  },
  bottomGlow: {
    position: 'absolute',
    left: -78,
    bottom: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(54, 93, 156, 0.08)',
  },
  centerOrb: {
    position: 'absolute',
    top: 140,
    alignSelf: 'center',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: premiumTheme.spacing.lg,
    paddingVertical: premiumTheme.spacing.xl,
    gap: premiumTheme.spacing.lg,
  },
});
