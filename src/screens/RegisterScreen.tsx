import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormTextField } from '../components/FormTextField';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { registerSchema } from '../features/auth/authSchemas';
import { useAppLanguage } from '../hooks/useAppLanguage';
import { translateKnownMessage } from '../i18n/translations';
import { authService } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';
import { premiumTheme } from '../theme/premium';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { copy, language, isRtl } = useAppLanguage();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function mapRegisterError(nextError: unknown): string {
    const rawMessage = nextError instanceof Error ? nextError.message : '';
    const message = rawMessage.toLowerCase();

    if (message.includes('already registered')) {
      return copy.auth.alreadyRegistered;
    }

    if (message.includes('wallet')) {
      return copy.auth.accountCreatedButWalletIncomplete;
    }

    if (message.includes('invalid api key') || message.includes('apikey') || message.includes('jwt malformed')) {
      return copy.auth.supabaseCredentialsInvalid;
    }

    if (message.includes('network request failed') || message.includes('failed to fetch') || message.includes('fetch')) {
      return copy.auth.couldNotReachAuthServer;
    }

    if (message.includes('supabase environment variables are missing')) {
      return copy.auth.supabaseEnvMissing;
    }

    if (rawMessage) {
      return `${copy.auth.unableToCreateAccountPrefix} ${translateKnownMessage(rawMessage, language)}`;
    }

    return copy.auth.unableToCreateAccount;
  }

  async function handleRegister() {
    const parsed = registerSchema.safeParse({ displayName, email, password });

    if (!parsed.success) {
      setError(translateKnownMessage(parsed.error.issues[0]?.message ?? copy.auth.invalidRegistrationDetails, language));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setMessage(null);
      const session = await authService.signUp(parsed.data);

      if (!session) {
        setMessage(copy.auth.accountCreated);
      }
    } catch (nextError) {
      console.error('[RegisterScreen] Sign up failed:', nextError);
      setError(mapRegisterError(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <SectionCard>
        <FormTextField label={copy.auth.displayName} value={displayName} onChangeText={setDisplayName} placeholder={copy.auth.optional} />
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
        {message ? <Text style={[styles.messageText, isRtl ? styles.textRtl : null]}>{message}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{copy.auth.createAccount}</Text>}
        </Pressable>
      </SectionCard>

      <View style={[styles.secondaryActions, isRtl ? styles.rowReverse : null]}>
        <Text style={[styles.secondaryText, isRtl ? styles.textRtl : null]}>{copy.auth.alreadyHaveAccount}</Text>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>{copy.auth.signInLink}</Text>
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
  messageText: {
    color: premiumTheme.colors.accentStrong,
    fontSize: 14,
    lineHeight: 20,
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
