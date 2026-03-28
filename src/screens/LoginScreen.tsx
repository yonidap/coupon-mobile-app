import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormTextField } from '../components/FormTextField';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { loginSchema } from '../features/auth/authSchemas';
import { useAppLanguage } from '../hooks/useAppLanguage';
import { translateKnownMessage } from '../i18n/translations';
import { authService } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';
import { premiumTheme } from '../theme/premium';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { copy, language, isRtl } = useAppLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function mapAuthError(nextError: unknown): string {
    const message = nextError instanceof Error ? nextError.message.toLowerCase() : '';

    if (message.includes('invalid login credentials')) {
      return copy.auth.incorrectCredentials;
    }

    if (message.includes('email not confirmed')) {
      return copy.auth.emailConfirmationRequired;
    }

    return copy.auth.unableToSignIn;
  }

  async function handleLogin() {
    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      setError(translateKnownMessage(parsed.error.issues[0]?.message ?? copy.auth.invalidLoginDetails, language));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await authService.signIn(parsed.data);
    } catch (nextError) {
      console.error('[LoginScreen] Sign in failed:', nextError);
      setError(mapAuthError(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <SectionCard>
        <FormTextField
          label={copy.auth.email}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <FormTextField
          label={copy.auth.password}
          value={password}
          onChangeText={setPassword}
          placeholder={copy.auth.minimumPassword}
          autoCapitalize="none"
          secureTextEntry
        />
        {error ? <Text style={[styles.errorText, isRtl ? styles.textRtl : null]}>{error}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{copy.auth.signIn}</Text>}
        </Pressable>
      </SectionCard>

      <View style={[styles.secondaryActions, isRtl ? styles.rowReverse : null]}>
        <Text style={[styles.secondaryText, isRtl ? styles.textRtl : null]}>{copy.auth.needAccount}</Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>{copy.auth.createAccountLink}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorText: {
    color: premiumTheme.colors.danger,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.accent,
    borderWidth: 1,
    borderColor: premiumTheme.colors.accentStrong,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryButtonText: {
    color: premiumTheme.colors.surfaceStrong,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  secondaryText: {
    color: premiumTheme.colors.muted,
  },
  linkText: {
    color: premiumTheme.colors.accent,
    fontWeight: '800',
  },
});
