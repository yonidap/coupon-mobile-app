import { memo } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useAppLanguage } from '../hooks/useAppLanguage';
import { premiumTheme } from '../theme/premium';

type FormTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  secureTextEntry?: boolean;
  error?: string;
};

export const FormTextField = memo(function FormTextField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'sentences',
  autoCorrect = false,
  keyboardType = 'default',
  multiline = false,
  secureTextEntry = false,
  error,
}: FormTextFieldProps) {
  const { isRtl } = useAppLanguage();

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, isRtl ? styles.labelRtl : null]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        style={[styles.input, isRtl ? styles.inputRtl : undefined, multiline ? styles.multilineInput : undefined, error ? styles.inputError : undefined]}
      />
      {error ? <Text style={[styles.error, isRtl ? styles.errorRtl : null]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: premiumTheme.colors.mutedStrong,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labelRtl: {
    textTransform: 'none',
    letterSpacing: 0,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    minHeight: 52,
    borderRadius: premiumTheme.radius.md,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceStrong,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: premiumTheme.colors.text,
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: premiumTheme.colors.danger,
    backgroundColor: premiumTheme.colors.dangerSoft,
  },
  error: {
    color: premiumTheme.colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  errorRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
