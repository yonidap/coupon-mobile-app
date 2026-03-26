import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormTextField } from '../components/FormTextField';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { loginSchema } from '../features/auth/authSchemas';
import { useAuthSession } from '../hooks/useAuthSession';
import { authService } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { isConfigured } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function mapAuthError(nextError: unknown): string {
    const message = nextError instanceof Error ? nextError.message.toLowerCase() : '';

    if (message.includes('invalid login credentials')) {
      return 'Incorrect email or password.';
    }

    if (message.includes('email not confirmed')) {
      return 'Please confirm your email before signing in.';
    }

    return 'Unable to sign in right now. Please try again.';
  }

  async function handleLogin() {
    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your login details.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await authService.signIn(parsed.data);
    } catch (nextError) {
      setError(mapAuthError(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <SectionCard
        title="Sign in"
        subtitle="A user account is required. Supabase Auth is the only entry point into the personal wallet MVP flow."
      >
        {!isConfigured ? (
          <Text style={styles.infoText}>Supabase env values are missing. Add them to `.env` before authenticating.</Text>
        ) : null}
        <FormTextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <FormTextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Minimum 6 characters"
          autoCapitalize="none"
          secureTextEntry
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
        </Pressable>
      </SectionCard>

      <View style={styles.secondaryActions}>
        <Text style={styles.secondaryText}>Need an account?</Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>Create account</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#556760',
  },
  errorText: {
    color: '#b94b4b',
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f5f4d',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#556760',
  },
  linkText: {
    color: '#1f5f4d',
    fontWeight: '700',
  },
});