import { memo } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

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
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline ? styles.multilineInput : undefined, error ? styles.inputError : undefined]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20302a',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c9d8d2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#17211d',
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#b94b4b',
  },
  error: {
    color: '#b94b4b',
    fontSize: 13,
  },
});