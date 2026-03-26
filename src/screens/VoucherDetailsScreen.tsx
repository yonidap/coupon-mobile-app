import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../components/EmptyState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { useAuthSession } from '../hooks/useAuthSession';
import { useDeleteVoucherMutation, useMarkVoucherRedeemedMutation, useVoucherDetails } from '../hooks/useVoucherQueries';
import type { RootStackParamList } from '../navigation/types';
import { attachmentService } from '../services/attachmentService';
import { formatCurrency, formatDateLabel } from '../utils/formatters';

type Props = NativeStackScreenProps<RootStackParamList, 'VoucherDetails'>;

export function VoucherDetailsScreen({ navigation, route }: Props) {
  const { user } = useAuthSession();
  const voucherQuery = useVoucherDetails(user?.id, route.params.voucherId);
  const deleteMutation = useDeleteVoucherMutation(user?.id);
  const markRedeemedMutation = useMarkVoucherRedeemedMutation(user?.id);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const voucher = voucherQuery.data?.voucher;

  async function handleOpenAttachment(attachmentId: string) {
    if (!voucher) {
      return;
    }

    const attachment = voucher.attachments.find((item) => item.id === attachmentId);

    if (!attachment) {
      return;
    }

    try {
      setAttachmentError(null);
      const signedUrl = await attachmentService.createSignedReadUrl(attachment);

      if (!signedUrl) {
        throw new Error('Attachment preview is not available for this file.');
      }

      await Linking.openURL(signedUrl);
    } catch (error) {
      setAttachmentError('Unable to open attachment. Please try again.');
    }
  }

  async function handleMarkRedeemed() {
    if (!voucher) {
      return;
    }

    Alert.alert('Mark as redeemed', 'This voucher will move to redeemed status.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark redeemed',
        onPress: async () => {
          try {
            await markRedeemedMutation.mutateAsync({ voucherId: voucher.id });
            Alert.alert('Updated', 'Voucher marked as redeemed.');
          } catch {
            Alert.alert('Update failed', 'We could not mark this voucher as redeemed. Please try again.');
          }
        },
      },
    ]);
  }

  async function handleDelete() {
    if (!voucher) {
      return;
    }

    Alert.alert('Delete voucher', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ voucherId: voucher.id });
            navigation.goBack();
          } catch {
            Alert.alert('Delete failed', 'We could not delete this voucher. Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      {voucherQuery.isLoading ? <ActivityIndicator color="#1f5f4d" /> : null}
      {voucherQuery.error ? <Text style={styles.errorText}>Unable to load voucher details right now.</Text> : null}

      {!voucherQuery.isLoading && !voucher ? <EmptyState title="Voucher not found" message="The requested voucher is not available in the current wallet context." /> : null}

      {voucher ? (
        <>
          <SectionCard title={voucher.title} subtitle={voucher.merchantName || 'No merchant name provided'}>
            <View style={styles.row}>
              <Text style={styles.label}>Expiry</Text>
              <Text style={styles.value}>{formatDateLabel(voucher.expiryDate)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Purchase date</Text>
              <Text style={styles.value}>{formatDateLabel(voucher.purchaseDate)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.value}>{voucher.category || 'Not set'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Currency</Text>
              <Text style={styles.value}>{voucher.currency}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Face value</Text>
              <Text style={styles.value}>{formatCurrency(voucher.faceValue, voucher.currency)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Paid value</Text>
              <Text style={styles.value}>{formatCurrency(voucher.paidValue, voucher.currency)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Code</Text>
              <Text style={styles.value}>{voucher.code || 'None'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{voucher.status}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Redeemed at</Text>
              <Text style={styles.value}>{formatDateLabel(voucher.redeemedAt)}</Text>
            </View>
            <View style={styles.stackRow}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.notesText}>{voucher.notes || 'No notes yet.'}</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('VoucherForm', { voucherId: voucher.id })}>
              <Text style={styles.primaryButtonText}>Edit voucher</Text>
            </Pressable>
            {voucher.status !== 'redeemed' ? (
              <Pressable style={styles.secondaryButton} onPress={handleMarkRedeemed} disabled={markRedeemedMutation.isPending}>
                <Text style={styles.secondaryButtonText}>{markRedeemedMutation.isPending ? 'Updating...' : 'Mark as redeemed'}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteMutation.isPending}>
              <Text style={styles.deleteButtonText}>{deleteMutation.isPending ? 'Deleting...' : 'Delete voucher'}</Text>
            </Pressable>
          </SectionCard>

          <SectionCard title="Attachments" subtitle="Attachment metadata is modeled separately so private storage and signed URL access can evolve without changing voucher rows.">
            {voucher.attachments.length === 0 ? (
              <Text style={styles.notesText}>No attachment records are attached to this voucher yet.</Text>
            ) : (
              voucher.attachments.map((attachment) => (
                <Pressable key={attachment.id} style={styles.attachmentRow} onPress={() => handleOpenAttachment(attachment.id)}>
                  <Text style={styles.value}>{attachment.fileName ?? attachment.storagePath}</Text>
                  <Text style={styles.attachmentMeta}>Open</Text>
                </Pressable>
              ))
            )}
            {attachmentError ? <Text style={styles.errorText}>{attachmentError}</Text> : null}
          </SectionCard>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  stackRow: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    color: '#556760',
    fontWeight: '600',
  },
  value: {
    fontSize: 15,
    color: '#18231e',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3b4a45',
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  attachmentMeta: {
    fontSize: 12,
    color: '#1f5f4d',
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f5f4d',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7efeb',
  },
  secondaryButtonText: {
    color: '#173029',
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5e5e5',
  },
  deleteButtonText: {
    color: '#8a1f1f',
    fontWeight: '700',
  },
  errorText: {
    color: '#b94b4b',
  },
});