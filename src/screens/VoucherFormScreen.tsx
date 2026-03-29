import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormTextField } from '../components/FormTextField';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { voucherCategories } from '../features/vouchers/categories';
import { duplicateVoucherCodeErrorMessage } from '../features/vouchers/errors';
import { createVoucherFormDefaults, mapVoucherToFormValues } from '../features/vouchers/formDefaults';
import { voucherCreateSchema, type VoucherFormValues } from '../features/vouchers/schemas';
import { useAppLanguage } from '../hooks/useAppLanguage';
import { useVoucherList, useExtractVoucherDraftMutation, useSaveVoucherMutation, useVoucherDetails } from '../hooks/useVoucherQueries';
import { getCategoryLabel, translateKnownMessage } from '../i18n/translations';
import { useAuthSession } from '../hooks/useAuthSession';
import type { RootStackParamList } from '../navigation/types';
import { attachmentService } from '../services/attachmentService';
import type { VoucherDraftSuggestion } from '../types/domain';
import { premiumTheme } from '../theme/premium';

type Props = NativeStackScreenProps<RootStackParamList, 'VoucherForm'>;

export function VoucherFormScreen({ navigation, route }: Props) {
  const { user } = useAuthSession();
  const { copy, language, isRtl } = useAppLanguage();
  const voucherId = route.params?.voucherId;
  const createMode = route.params?.createMode ?? 'manual';
  const initialVoucherType = route.params?.initialVoucherType;
  const autoPickAttachment = route.params?.autoPickAttachment ?? false;
  const shouldExtractOnAttachment = Boolean(voucherId) || createMode === 'upload';
  const voucherQuery = useVoucherDetails(user?.id, voucherId);
  const vouchersQuery = useVoucherList(user?.id);
  const saveMutation = useSaveVoucherMutation(user?.id);
  const extractDraftMutation = useExtractVoucherDraftMutation(user?.id);
  const appliedInitialTypeRef = useRef(false);
  const autoPickAttemptedRef = useRef(false);
  const [autoFillMessage, setAutoFillMessage] = useState<{
    tone: 'info' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    clearErrors,
    setValue,
    getValues,
    watch,
  } = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherCreateSchema),
    defaultValues: createVoucherFormDefaults('ILS'),
  });

  useEffect(() => {
    if (voucherQuery.data?.voucher) {
      reset(mapVoucherToFormValues(voucherQuery.data.voucher));
      setAutoFillMessage(null);
    }
  }, [reset, voucherQuery.data?.voucher]);

  const selectedAttachment = watch('attachment');
  const voucherType = watch('voucherType');

  useEffect(() => {
    appliedInitialTypeRef.current = false;
    autoPickAttemptedRef.current = false;
  }, [voucherId, createMode, initialVoucherType, autoPickAttachment]);

  useEffect(() => {
    if (voucherId || appliedInitialTypeRef.current) {
      return;
    }

    if (initialVoucherType === 'monetary' || initialVoucherType === 'product') {
      setValue('voucherType', initialVoucherType, { shouldDirty: false });
      appliedInitialTypeRef.current = true;
    }
  }, [initialVoucherType, setValue, voucherId]);

  function getValidationMessage(): string {
    const firstError = Object.values(errors)[0];

    if (!firstError) {
      return copy.voucherForm.reviewHighlightedFields;
    }

    return 'message' in firstError && typeof firstError.message === 'string'
      ? translateKnownMessage(firstError.message, language)
      : copy.voucherForm.reviewHighlightedFields;
  }

  function toFormAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  }

  function normalizeCode(value: string): string {
    return value.trim().toLowerCase();
  }

  function hasDuplicateCode(code: string): boolean {
    const normalizedCode = normalizeCode(code);

    if (!normalizedCode || !vouchersQuery.data) {
      return false;
    }

    return vouchersQuery.data.vouchers.some((voucher) => {
      if (voucher.id === voucherId) {
        return false;
      }

      return normalizeCode(voucher.code ?? '') === normalizedCode;
    });
  }

  function setSuggestedValue<K extends keyof VoucherFormValues>(field: K, nextValue: VoucherFormValues[K]): boolean {
    const current = getValues(field) as VoucherFormValues[K];

    if (current === nextValue) {
      return false;
    }

    setValue(field, nextValue as never, { shouldDirty: true });
    return true;
  }

  function applyDraftSuggestion(suggestion: VoucherDraftSuggestion): number {
    let appliedCount = 0;
    const effectiveType = getValues('voucherType');

    if (suggestion.category) {
      if (setSuggestedValue('category', suggestion.category)) {
        appliedCount += 1;
      }
    }

    if (suggestion.merchantName?.trim()) {
      if (setSuggestedValue('merchantName', suggestion.merchantName.trim())) {
        appliedCount += 1;
      }
    }

    if (effectiveType === 'product' && suggestion.productName?.trim()) {
      if (setSuggestedValue('productName', suggestion.productName.trim())) {
        appliedCount += 1;
      }
    }

    if (effectiveType === 'monetary' && suggestion.faceValue !== null && Number.isFinite(suggestion.faceValue)) {
      if (setSuggestedValue('faceValue', toFormAmount(suggestion.faceValue))) {
        appliedCount += 1;
      }
    }

    if (effectiveType === 'monetary' && suggestion.usedValue !== null && Number.isFinite(suggestion.usedValue)) {
      if (setSuggestedValue('usedValue', toFormAmount(suggestion.usedValue))) {
        appliedCount += 1;
      }
    }

    if (suggestion.expiryDate?.trim()) {
      if (setSuggestedValue('expiryDate', suggestion.expiryDate.trim())) {
        appliedCount += 1;
      }
    }

    if (suggestion.code?.trim()) {
      if (setSuggestedValue('code', suggestion.code.trim())) {
        appliedCount += 1;
      }
    }

    if (suggestion.notes?.trim() && !getValues('notes').trim()) {
      if (setSuggestedValue('notes', suggestion.notes.trim())) {
        appliedCount += 1;
      }
    }

    return appliedCount;
  }

  async function handlePickAttachment() {
    try {
      const attachment = await attachmentService.pickAttachment();

      if (attachment) {
        setValue('attachment', attachment, { shouldDirty: true });

        if (!shouldExtractOnAttachment) {
          setAutoFillMessage({
            tone: 'info',
            text: copy.voucherForm.attachmentAddedManualMode,
          });
          return;
        }

        setAutoFillMessage({
          tone: 'info',
          text: copy.voucherForm.extractingDetails,
        });

        try {
          const extractionResult = await extractDraftMutation.mutateAsync({ attachment });
          if (extractionResult.warnings.length > 0) {
            console.warn(
              '[VoucherFormScreen] Draft extraction warnings:',
              extractionResult.warnings,
              JSON.stringify(extractionResult.warnings),
            );
          }
          console.log('[VoucherFormScreen] Draft extraction suggestion:', extractionResult.suggestion);
          const appliedCount = applyDraftSuggestion(extractionResult.suggestion);

          if (appliedCount > 0) {
            setAutoFillMessage({
              tone: 'info',
              text: copy.voucherForm.autoFillReviewNotice,
            });
          } else {
            setAutoFillMessage({
              tone: 'warning',
              text: copy.voucherForm.autoFillNoDetailsFound,
            });
          }
        } catch (error) {
          console.error('[VoucherFormScreen] Draft extraction failed:', error);
          const translatedMessage = error instanceof Error ? translateKnownMessage(error.message, language) : '';
          const message = error instanceof Error && translatedMessage !== error.message ? translatedMessage : copy.voucherForm.extractionFailedMessage;

          setAutoFillMessage({
            tone: 'error',
            text: message || copy.voucherForm.extractionFailedMessage,
          });
        }
      }
    } catch (error) {
      console.error('[VoucherFormScreen] Attachment pick failed:', error);
      Alert.alert(copy.voucherForm.attachmentFailedTitle, copy.voucherForm.attachmentFailedMessage);
    }
  }

  useEffect(() => {
    if (voucherId || createMode !== 'upload' || !autoPickAttachment || autoPickAttemptedRef.current) {
      return;
    }

    autoPickAttemptedRef.current = true;
    void handlePickAttachment();
  }, [autoPickAttachment, createMode, voucherId]);

  const onSubmit = handleSubmit(
    async (values) => {
      if (hasDuplicateCode(values.code)) {
        setError('code', {
          type: 'duplicate',
          message: duplicateVoucherCodeErrorMessage,
        });
        return;
      }

      try {
        const savedVoucher = await saveMutation.mutateAsync({
          voucherId,
          values,
        });

        Alert.alert(copy.voucherForm.voucherSavedTitle, copy.voucherForm.voucherSavedMessage);
        navigation.replace('VoucherDetails', { voucherId: savedVoucher.id });
      } catch (error) {
        console.error('[VoucherFormScreen] Save voucher failed:', error);
        const message = error instanceof Error ? error.message : '';

        if (message === duplicateVoucherCodeErrorMessage) {
          setError('code', {
            type: 'duplicate',
            message: duplicateVoucherCodeErrorMessage,
          });
          return;
        }

        Alert.alert(copy.voucherForm.unableToSaveVoucherTitle, error instanceof Error ? translateKnownMessage(error.message, language) : copy.voucherForm.unableToSaveVoucherMessage);
      }
    },
    () => {
      console.error('[VoucherFormScreen] Validation failed:', errors);
      Alert.alert(copy.voucherForm.formIncompleteTitle, getValidationMessage());
    },
  );

  return (
    <ScreenContainer>
      {voucherId && voucherQuery.isLoading ? <ActivityIndicator color={premiumTheme.colors.accent} /> : null}
      <SectionCard>
        {Object.keys(errors).length > 0 ? <Text style={styles.errorText}>{getValidationMessage()}</Text> : null}

        <Text style={[styles.typeLabel, isRtl ? styles.labelRtl : null]}>{copy.voucherForm.type}</Text>
        <View style={[styles.typeSelectorRow, isRtl ? styles.rowReverse : null]}>
          <Pressable
            style={[styles.typeChip, voucherType === 'monetary' ? styles.typeChipActive : null]}
            onPress={() => setValue('voucherType', 'monetary', { shouldDirty: true })}
          >
            <Text style={[styles.typeChipText, voucherType === 'monetary' ? styles.typeChipTextActive : null]}>{copy.voucherForm.money}</Text>
          </Pressable>
          <Pressable
            style={[styles.typeChip, voucherType === 'product' ? styles.typeChipActive : null]}
            onPress={() => setValue('voucherType', 'product', { shouldDirty: true })}
          >
            <Text style={[styles.typeChipText, voucherType === 'product' ? styles.typeChipTextActive : null]}>{copy.voucherForm.product}</Text>
          </Pressable>
        </View>

        <Text style={[styles.typeLabel, isRtl ? styles.labelRtl : null]}>{copy.voucherForm.category}</Text>
        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <View style={[styles.categoryWrap, isRtl ? styles.rowReverse : null]}>
              {voucherCategories.map((option) => {
                const selected = value === option;

                return (
                  <Pressable
                    key={option}
                    style={[styles.categoryChip, selected ? styles.categoryChipActive : null]}
                    onPress={() => onChange(option)}
                  >
                    <Text style={[styles.categoryChipText, selected ? styles.categoryChipTextActive : null]}>{getCategoryLabel(option, language)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
        {errors.category ? <Text style={styles.errorText}>{errors.category.message}</Text> : null}

        {voucherType === 'product' ? (
          <Controller
            control={control}
            name="productName"
            render={({ field: { value, onChange } }) => (
              <FormTextField
                label={copy.voucherForm.productName}
                value={value}
                onChangeText={onChange}
                placeholder={copy.voucherForm.productNamePlaceholder}
                error={errors.productName?.message ? translateKnownMessage(errors.productName.message, language) : undefined}
              />
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="merchantName"
          render={({ field: { value, onChange } }) => (
            <FormTextField
              label={copy.voucherForm.merchantName}
              value={value}
              onChangeText={onChange}
              placeholder={copy.voucherForm.merchantNamePlaceholder}
              error={errors.merchantName?.message ? translateKnownMessage(errors.merchantName.message, language) : undefined}
            />
          )}
        />

        {voucherType === 'monetary' ? (
          <>
            <View style={[styles.twoColumnRow, isRtl ? styles.rowReverse : null]}>
              <View style={styles.column}>
                <Controller
                  control={control}
                  name="faceValue"
                  render={({ field: { value, onChange } }) => (
                    <FormTextField
                      label={copy.voucherForm.faceValue}
                      value={value}
                      onChangeText={onChange}
                      placeholder={copy.voucherForm.faceValuePlaceholder}
                      keyboardType="decimal-pad"
                      error={errors.faceValue?.message ? translateKnownMessage(errors.faceValue.message, language) : undefined}
                    />
                  )}
                />
              </View>
              <View style={styles.column}>
                <Controller
                  control={control}
                  name="usedValue"
                  render={({ field: { value, onChange } }) => (
                    <FormTextField
                      label={copy.voucherForm.usedValue}
                      value={value}
                      onChangeText={onChange}
                      placeholder={copy.voucherForm.usedValuePlaceholder}
                      keyboardType="decimal-pad"
                      error={errors.usedValue?.message ? translateKnownMessage(errors.usedValue.message, language) : undefined}
                    />
                  )}
                />
              </View>
            </View>
            <Controller
              control={control}
              name="currency"
              render={({ field: { value, onChange } }) => (
                <FormTextField
                  label={copy.voucherForm.currency}
                  value={value}
                  onChangeText={onChange}
                  placeholder={copy.voucherForm.currencyPlaceholder}
                  autoCapitalize="characters"
                  error={errors.currency?.message ? translateKnownMessage(errors.currency.message, language) : undefined}
                />
              )}
            />
          </>
        ) : null}

        <Controller
          control={control}
          name="expiryDate"
          render={({ field: { value, onChange } }) => (
            <FormTextField
              label={copy.voucherForm.expiryDate}
              value={value}
              onChangeText={onChange}
              placeholder={copy.voucherForm.expiryDatePlaceholder}
              autoCapitalize="none"
              error={errors.expiryDate?.message ? translateKnownMessage(errors.expiryDate.message, language) : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="code"
          render={({ field: { value, onChange } }) => (
            <FormTextField
              label={copy.voucherForm.code}
              value={value}
              onChangeText={(nextValue) => {
                if (errors.code?.type === 'duplicate') {
                  clearErrors('code');
                }

                onChange(nextValue);
              }}
              placeholder={copy.voucherForm.codePlaceholder}
              autoCapitalize="characters"
              error={errors.code?.message ? translateKnownMessage(errors.code.message, language) : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange } }) => (
            <FormTextField
              label={copy.voucherForm.notes}
              value={value}
              onChangeText={onChange}
              placeholder={copy.voucherForm.notesPlaceholder}
              multiline
              error={errors.notes?.message ? translateKnownMessage(errors.notes.message, language) : undefined}
            />
          )}
        />
        <Pressable style={styles.secondaryButton} onPress={handlePickAttachment} disabled={extractDraftMutation.isPending}>
          <Text style={styles.secondaryButtonText}>{extractDraftMutation.isPending ? copy.voucherForm.extractingDetails : copy.voucherForm.pickImageOrPdf}</Text>
        </Pressable>
        {selectedAttachment ? (
          <Text style={[styles.attachmentText, isRtl ? styles.textRtl : null]}>
            {selectedAttachment.name} · {selectedAttachment.mimeType ?? copy.common.unknownType}
          </Text>
        ) : null}
        {autoFillMessage ? (
          <Text
            style={[
              styles.autoFillMessage,
              autoFillMessage.tone === 'warning' ? styles.autoFillMessageWarning : null,
              autoFillMessage.tone === 'error' ? styles.autoFillMessageError : null,
              isRtl ? styles.textRtl : null,
            ]}
          >
            {autoFillMessage.text}
          </Text>
        ) : null}
      </SectionCard>

      <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? <ActivityIndicator color={premiumTheme.colors.surfaceStrong} /> : <Text style={styles.primaryButtonText}>{copy.voucherForm.saveVoucher}</Text>}
      </Pressable>
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
  labelRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
    textTransform: 'none',
    letterSpacing: 0,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  typeLabel: {
    color: premiumTheme.colors.mutedStrong,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 11,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: premiumTheme.colors.surfaceStrong,
  },
  categoryChipActive: {
    backgroundColor: premiumTheme.colors.accent,
    borderColor: premiumTheme.colors.accentStrong,
  },
  categoryChipText: {
    color: premiumTheme.colors.mutedStrong,
    fontWeight: '800',
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: premiumTheme.colors.surfaceStrong,
  },
  typeChip: {
    flex: 1,
    minHeight: 50,
    borderRadius: premiumTheme.radius.md,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.surfaceStrong,
  },
  typeChipActive: {
    backgroundColor: premiumTheme.colors.accent,
    borderColor: premiumTheme.colors.accentStrong,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  typeChipText: {
    color: premiumTheme.colors.mutedStrong,
    fontWeight: '800',
  },
  typeChipTextActive: {
    color: premiumTheme.colors.surfaceStrong,
  },
  attachmentText: {
    color: premiumTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  autoFillMessage: {
    color: premiumTheme.colors.accentStrong,
    fontSize: 13,
    fontWeight: '700',
  },
  autoFillMessageWarning: {
    color: premiumTheme.colors.mutedStrong,
  },
  autoFillMessageError: {
    color: premiumTheme.colors.danger,
  },
  primaryButton: {
    minHeight: 52,
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
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  secondaryButtonText: {
    color: premiumTheme.colors.mutedStrong,
    fontWeight: '800',
  },
  errorText: {
    color: premiumTheme.colors.danger,
    fontSize: 14,
  },
});
