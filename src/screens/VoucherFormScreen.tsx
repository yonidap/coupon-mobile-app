import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormTextField } from '../components/FormTextField';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { createVoucherFormDefaults, mapVoucherToFormValues } from '../features/vouchers/formDefaults';
import { voucherCreateSchema, type VoucherFormValues } from '../features/vouchers/schemas';
import { useAuthSession } from '../hooks/useAuthSession';
import { useSaveVoucherMutation, useVoucherDetails } from '../hooks/useVoucherQueries';
import type { RootStackParamList } from '../navigation/types';
import { attachmentService } from '../services/attachmentService';

type Props = NativeStackScreenProps<RootStackParamList, 'VoucherForm'>;

export function VoucherFormScreen({ navigation, route }: Props) {
  const { user } = useAuthSession();
  const voucherId = route.params?.voucherId;
  const voucherQuery = useVoucherDetails(user?.id, voucherId);
  const saveMutation = useSaveVoucherMutation(user?.id);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherCreateSchema),
    defaultValues: createVoucherFormDefaults('ILS'),
  });

  useEffect(() => {
    if (voucherQuery.data?.voucher) {
      reset(mapVoucherToFormValues(voucherQuery.data.voucher));
    }
  }, [reset, voucherQuery.data?.voucher]);

  const selectedAttachment = watch('attachment');

  async function handlePickAttachment() {
    try {
      const attachment = await attachmentService.pickAttachment();

      if (attachment) {
        setValue('attachment', attachment, { shouldDirty: true });
      }
    } catch {
      Alert.alert('Attachment failed', 'Unable to pick this file. Please try a different image or PDF.');
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const savedVoucher = await saveMutation.mutateAsync({
        voucherId,
        values,
      });

      Alert.alert('Voucher saved', 'The starter voucher flow has been updated.');
      navigation.replace('VoucherDetails', { voucherId: savedVoucher.id });
    } catch {
      Alert.alert('Unable to save voucher', 'Please review your values and try again.');
    }
  });

  return (
    <ScreenContainer>
      {voucherId && voucherQuery.isLoading ? <ActivityIndicator color="#1f5f4d" /> : null}
      <SectionCard title={voucherId ? 'Edit voucher' : 'Create voucher'} subtitle="Manual entry is the only supported creation path in the MVP. Future OCR/email/barcode ingestion should reuse the same voucher service boundary.">
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange } }) => (
            <FormTextField label="Title" value={value} onChangeText={onChange} placeholder="Gift card, dining coupon, spa voucher..." error={errors.title?.message} />
          )}
        />
        <Controller
          control={control}
          name="merchantName"
          render={({ field: { value, onChange } }) => (
            <FormTextField label="Merchant name" value={value} onChangeText={onChange} placeholder="Merchant or brand" error={errors.merchantName?.message} />
          )}
        />
        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <FormTextField label="Category" value={value} onChangeText={onChange} placeholder="Dining, travel, beauty..." error={errors.category?.message} />
          )}
        />
        <View style={styles.twoColumnRow}>
          <View style={styles.column}>
            <Controller
              control={control}
              name="faceValue"
              render={({ field: { value, onChange } }) => (
                <FormTextField label="Face value" value={value} onChangeText={onChange} placeholder="Optional" keyboardType="decimal-pad" error={errors.faceValue?.message} />
              )}
            />
          </View>
          <View style={styles.column}>
            <Controller
              control={control}
              name="paidValue"
              render={({ field: { value, onChange } }) => (
                <FormTextField label="Paid value" value={value} onChangeText={onChange} placeholder="Optional" keyboardType="decimal-pad" error={errors.paidValue?.message} />
              )}
            />
          </View>
        </View>
        <Controller
          control={control}
          name="currency"
          render={({ field: { value, onChange } }) => (
            <FormTextField label="Currency" value={value} onChangeText={onChange} placeholder="USD" autoCapitalize="characters" error={errors.currency?.message} />
          )}
        />
        <View style={styles.twoColumnRow}>
          <View style={styles.column}>
            <Controller
              control={control}
              name="purchaseDate"
              render={({ field: { value, onChange } }) => (
                <FormTextField label="Purchase date" value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" autoCapitalize="none" error={errors.purchaseDate?.message} />
              )}
            />
          </View>
          <View style={styles.column}>
            <Controller
              control={control}
              name="expiryDate"
              render={({ field: { value, onChange } }) => (
                <FormTextField label="Expiry date" value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" autoCapitalize="none" error={errors.expiryDate?.message} />
              )}
            />
          </View>
        </View>
        <Controller
          control={control}
          name="code"
          render={({ field: { value, onChange } }) => (
            <FormTextField label="Code" value={value} onChangeText={onChange} placeholder="Optional redemption code" autoCapitalize="characters" error={errors.code?.message} />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange } }) => (
            <FormTextField label="Notes" value={value} onChangeText={onChange} placeholder="Terms, constraints, gift details..." multiline error={errors.notes?.message} />
          )}
        />
      </SectionCard>

      <SectionCard title="Attachment" subtitle="Image/PDF picking is scaffolded. Private upload and signed retrieval should remain behind the attachment service boundary.">
        <Pressable style={styles.secondaryButton} onPress={handlePickAttachment}>
          <Text style={styles.secondaryButtonText}>Pick image or PDF</Text>
        </Pressable>
        {selectedAttachment ? (
          <Text style={styles.attachmentText}>{selectedAttachment.name} · {selectedAttachment.mimeType ?? 'unknown type'}</Text>
        ) : (
          <Text style={styles.helperText}>No attachment selected.</Text>
        )}
      </SectionCard>

      <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{voucherId ? 'Save changes' : 'Create voucher'}</Text>}
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  helperText: {
    color: '#556760',
    fontSize: 14,
  },
  attachmentText: {
    color: '#18231e',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f5f4d',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7efeb',
  },
  secondaryButtonText: {
    color: '#173029',
    fontWeight: '700',
  },
});