import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormTextField } from '../components/FormTextField';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { registerSchema } from '../features/auth/authSchemas';
import { authService } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function mapRegisterError(nextError: unknown): string {
    const message = nextError instanceof Error ? nextError.message.toLowerCase() : '';

    if (message.includes('already registered')) {
      return 'This email is already registered. Try signing in instead.';
    }

    if (message.includes('wallet')) {
      return 'Account created, but personal wallet setup is incomplete. Please sign out and sign in again.';
    }

    return 'Unable to create account right now. Please try again.';
  }

  async function handleRegister() {
    const parsed = registerSchema.safeParse({ displayName, email, password });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details and try again.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setMessage(null);
      const session = await authService.signUp(parsed.data);

      if (!session) {
        setMessage('Account created. If email confirmation is enabled in Supabase, confirm your email before signing in.');
      }
    } catch (nextError) {
      setError(mapRegisterError(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <SectionCard title="Create account" subtitle="Personal wallet first. Shared/family wallet support is prepared behind the scenes.">
        <FormTextField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Optional" />
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
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Create account</Text>}
        </Pressable>
      </SectionCard>

      <View style={styles.secondaryActions}>
        <Text style={styles.secondaryText}>Already have an account?</Text>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Sign in</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: '#b94b4b',
    fontSize: 14,
  },
  messageText: {
    color: '#1f5f4d',
    fontSize: 14,
    lineHeight: 20,
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