import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../components/EmptyState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { useAuthSession } from '../hooks/useAuthSession';
import { useAppLanguage } from '../hooks/useAppLanguage';
import {
  formatCurrency,
  formatDateLabel,
} from '../utils/formatters';
import {
  getCategoryLabel,
  getVoucherStatusLabel,
  translateKnownMessage,
} from '../i18n/translations';
import { useAddVoucherUsageMutation, useDeleteVoucherMutation, useMarkVoucherRedeemedMutation, useVoucherDetails } from '../hooks/useVoucherQueries';
import type { RootStackParamList } from '../navigation/types';
import { attachmentService } from '../services/attachmentService';
import { premiumTheme } from '../theme/premium';

type Props = NativeStackScreenProps<RootStackParamList, 'VoucherDetails'>;
type ConfirmActionType = 'markRedeemed' | 'delete' | null;
type NoteSegment = {
  text: string;
  url?: string;
};

const noteLinkPattern =
  /\b((?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:\/[^\s<>"']*)?)/gi;
const trailingNoteLinkPunctuationPattern = /[),.;:!?]+$/;

function normalizeNoteUrl(rawValue: string): string {
  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  return `https://${rawValue}`;
}

function splitNoteSegments(note: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let cursor = 0;
  const matcher = new RegExp(noteLinkPattern);

  for (const match of note.matchAll(matcher)) {
    const index = match.index ?? 0;
    const matchedValue = match[0];

    if (index > cursor) {
      segments.push({ text: note.slice(cursor, index) });
    }

    const trailingMatch = matchedValue.match(trailingNoteLinkPunctuationPattern);
    const trailing = trailingMatch?.[0] ?? '';
    const cleanValue = trailing ? matchedValue.slice(0, -trailing.length) : matchedValue;

    if (cleanValue) {
      const hasLinkPrefix = /^(?:https?:\/\/|www\.)/i.test(cleanValue);
      const isEmailContext = !hasLinkPrefix && index > 0 && note[index - 1] === '@';

      if (isEmailContext) {
        segments.push({ text: cleanValue });
      } else {
        segments.push({
          text: cleanValue,
          url: normalizeNoteUrl(cleanValue),
        });
      }
    }

    if (trailing) {
      segments.push({ text: trailing });
    }

    cursor = index + matchedValue.length;
  }

  if (cursor < note.length) {
    segments.push({ text: note.slice(cursor) });
  }

  if (segments.length === 0) {
    return [{ text: note }];
  }

  return segments;
}

export function VoucherDetailsScreen({ navigation, route }: Props) {
  const { user } = useAuthSession();
  const { copy, language, locale, isRtl } = useAppLanguage();
  const voucherQuery = useVoucherDetails(user?.id, route.params.voucherId);
  const deleteMutation = useDeleteVoucherMutation(user?.id);
  const markRedeemedMutation = useMarkVoucherRedeemedMutation(user?.id);
  const addUsageMutation = useAddVoucherUsageMutation(user?.id);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUsageModalVisible, setUsageModalVisible] = useState(false);
  const [usageAmountInput, setUsageAmountInput] = useState('');
  const [confirmActionType, setConfirmActionType] = useState<ConfirmActionType>(null);
  const voucher = voucherQuery.data?.voucher;
  const isConfirmPending = markRedeemedMutation.isPending || deleteMutation.isPending;
  const confirmConfig =
    confirmActionType === 'delete'
      ? {
          title: copy.voucherDetails.deleteVoucherTitle,
          message: copy.voucherDetails.deleteVoucherMessage,
          confirmLabel: deleteMutation.isPending ? copy.common.deleting : copy.common.delete,
          destructive: true,
        }
      : confirmActionType === 'markRedeemed'
        ? {
          title: copy.voucherDetails.markRedeemedTitle,
          message: copy.voucherDetails.markRedeemedMessage,
          confirmLabel: markRedeemedMutation.isPending ? copy.common.updating : copy.voucherDetails.markAsRedeemed,
          destructive: false,
        }
        : null;

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
      console.error('[VoucherDetailsScreen] Open attachment failed:', error);
      setAttachmentError(copy.voucherDetails.attachmentFailedMessage);
    }
  }

  async function handleOpenNoteLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('[VoucherDetailsScreen] Open notes link failed:', error);
    }
  }

  function renderNotesText(note: string) {
    return splitNoteSegments(note).map((segment, index) => {
      if (!segment.url) {
        return segment.text;
      }

      const linkUrl = segment.url;
      return (
        <Text key={`${linkUrl}-${index}`} style={styles.notesLink} onPress={() => void handleOpenNoteLink(linkUrl)}>
          {segment.text}
        </Text>
      );
    });
  }

  function handleMarkRedeemed() {
    if (!voucher) {
      return;
    }

    setConfirmActionType('markRedeemed');
  }

  function closeConfirmModal() {
    if (isConfirmPending) {
      return;
    }

    setConfirmActionType(null);
  }

  function openUsageModal() {
    setUsageAmountInput('');
    setUsageModalVisible(true);
  }

  function closeUsageModal() {
    if (addUsageMutation.isPending) {
      return;
    }

    setUsageModalVisible(false);
  }

  async function handleSubmitUsageUpdate() {
    if (!voucher || voucher.voucherType !== 'monetary' || voucher.faceValue === null) {
      return;
    }

    const parsedAmount = Number(usageAmountInput.trim().replace(',', '.'));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(copy.common.invalidAmountTitle, copy.common.invalidAmountMessage);
      return;
    }

    try {
      await addUsageMutation.mutateAsync({
        voucherId: voucher.id,
        amount: parsedAmount,
      });
      setUsageModalVisible(false);
      setUsageAmountInput('');
      Alert.alert(copy.common.updatedTitle, copy.voucherDetails.usageUpdatedMessage);
    } catch (error) {
      console.error('[VoucherDetailsScreen] Update usage failed:', error);
      const message = error instanceof Error ? translateKnownMessage(error.message, language) : copy.common.updateFailedTitle;
      Alert.alert(copy.common.updateFailedTitle, message);
    }
  }

  function handleDelete() {
    if (!voucher) {
      return;
    }

    setConfirmActionType('delete');
  }

  async function handleConfirmAction() {
    if (!voucher || !confirmActionType) {
      return;
    }

    if (confirmActionType === 'markRedeemed') {
      try {
        await markRedeemedMutation.mutateAsync({ voucherId: voucher.id });
        setConfirmActionType(null);
        Alert.alert(copy.common.updatedTitle, copy.voucherDetails.markRedeemedMessage);
      } catch (error) {
        console.error('[VoucherDetailsScreen] Mark redeemed failed:', error);
        const message = error instanceof Error ? translateKnownMessage(error.message, language) : copy.common.updateFailedTitle;
        Alert.alert(copy.common.updateFailedTitle, message);
      }

      return;
    }

    try {
      await deleteMutation.mutateAsync({ voucherId: voucher.id });
      setConfirmActionType(null);
      navigation.navigate('Home');
    } catch (error) {
      console.error('[VoucherDetailsScreen] Delete voucher failed:', error);
      const message = error instanceof Error ? translateKnownMessage(error.message, language) : copy.common.deleteFailedTitle;
      Alert.alert(copy.common.deleteFailedTitle, message);
    }
  }

  return (
    <ScreenContainer>
      {voucherQuery.isLoading ? <ActivityIndicator color={premiumTheme.colors.accent} /> : null}
      {voucherQuery.error ? <Text style={styles.errorText}>{copy.voucherDetails.unableToLoadDetails}</Text> : null}

      {!voucherQuery.isLoading && !voucher ? <EmptyState title={copy.voucherDetails.notFoundTitle} message={copy.voucherDetails.notFoundMessage} /> : null}

      {voucher ? (
        <>
          <SectionCard
            title={voucher.voucherType === 'product' ? voucher.productName || voucher.title : voucher.merchantName || voucher.title}
          >
            <View style={styles.detailsBox}>
              <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.category}</Text>
                <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{voucher.category ? getCategoryLabel(voucher.category, language) : copy.common.other}</Text>
              </View>
              <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.expiry}</Text>
                <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{formatDateLabel(voucher.expiryDate, { locale, missingLabel: copy.common.notSet })}</Text>
              </View>
              {voucher.voucherType === 'monetary' ? (
                <>
                  <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                    <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.merchant}</Text>
                    <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{voucher.merchantName || copy.common.notSet}</Text>
                  </View>
                  <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                    <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.totalValue}</Text>
                    <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{formatCurrency(voucher.faceValue, voucher.currency, { locale, missingLabel: copy.common.noValue })}</Text>
                  </View>
                  <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                    <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.usedValue}</Text>
                    <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{formatCurrency(voucher.usedValue, voucher.currency, { locale, missingLabel: copy.common.noValue })}</Text>
                  </View>
                  <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                    <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.remainingValue}</Text>
                    <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{formatCurrency(voucher.remainingValue, voucher.currency, { locale, missingLabel: copy.common.noValue })}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                    <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.product}</Text>
                    <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{voucher.productName || voucher.title}</Text>
                  </View>
                  <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                    <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.merchant}</Text>
                    <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{voucher.merchantName || copy.common.notSet}</Text>
                  </View>
                </>
              )}
              <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.code}</Text>
                <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{voucher.code || copy.common.none}</Text>
              </View>
              <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.status}</Text>
                <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{getVoucherStatusLabel(voucher.status, language)}</Text>
              </View>
              <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.redeemedAt}</Text>
                <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{formatDateLabel(voucher.redeemedAt, { locale, missingLabel: copy.common.notSet })}</Text>
              </View>
              {voucher.attachments.length === 0 ? (
                <View style={[styles.row, isRtl ? styles.rowReverse : null]}>
                  <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.attachment}</Text>
                  <Text style={[styles.value, isRtl ? styles.valueRtl : null]}>{copy.voucherDetails.noAttachments}</Text>
                </View>
              ) : (
                <>
                  {voucher.attachments.map((attachment) => (
                    <Pressable
                      key={attachment.id}
                      style={[styles.row, styles.rowPressable, isRtl ? styles.rowReverse : null]}
                      onPress={() => handleOpenAttachment(attachment.id)}
                    >
                      <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.attachment}</Text>
                      <View style={[styles.attachmentValueGroup, isRtl ? styles.attachmentValueGroupRtl : null]}>
                        <Text style={[styles.value, styles.attachmentFileValue, isRtl ? styles.valueRtl : null]} numberOfLines={1}>
                          {attachment.fileName ?? attachment.storagePath}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
              <View style={[styles.rowStack, isRtl ? styles.rowStackRtl : null]}>
                <Text style={[styles.label, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.notes}</Text>
                <Text style={[styles.notesText, isRtl ? styles.textRtl : null]}>
                  {voucher.notes?.trim() ? renderNotesText(voucher.notes) : copy.common.noNotesYet}
                </Text>
              </View>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('VoucherForm', { voucherId: voucher.id })}>
              <Text style={styles.primaryButtonText}>{copy.voucherDetails.editVoucher}</Text>
            </Pressable>
            {voucher.voucherType === 'product' && voucher.status !== 'redeemed' ? (
              <Pressable style={styles.secondaryButton} onPress={handleMarkRedeemed} disabled={markRedeemedMutation.isPending}>
                <Text style={styles.secondaryButtonText}>{markRedeemedMutation.isPending ? copy.common.updating : copy.voucherDetails.markAsRedeemed}</Text>
              </Pressable>
            ) : null}
            {voucher.voucherType === 'monetary' && voucher.status !== 'redeemed' ? (
              <Pressable style={styles.secondaryButton} onPress={openUsageModal} disabled={addUsageMutation.isPending}>
                <Text style={styles.secondaryButtonText}>{addUsageMutation.isPending ? copy.common.updating : copy.voucherDetails.updateUsage}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteMutation.isPending}>
              <Text style={styles.deleteButtonText}>{deleteMutation.isPending ? copy.common.deleting : copy.voucherDetails.deleteVoucher}</Text>
            </Pressable>
            {attachmentError ? <Text style={styles.errorText}>{attachmentError}</Text> : null}
          </SectionCard>

          <Modal visible={confirmActionType !== null} transparent animationType="fade" onRequestClose={closeConfirmModal}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={[styles.modalTitle, isRtl ? styles.textRtl : null]}>{confirmConfig?.title}</Text>
                <Text style={[styles.modalSubtitle, isRtl ? styles.textRtl : null]}>{confirmConfig?.message}</Text>
                <View style={[styles.modalActions, isRtl ? styles.rowReverse : null]}>
                  <Pressable style={styles.modalCancelButton} onPress={closeConfirmModal} disabled={isConfirmPending}>
                    <Text style={styles.modalCancelText}>{copy.common.cancel}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalConfirmButton, confirmConfig?.destructive ? styles.modalConfirmButtonDestructive : null]}
                    onPress={handleConfirmAction}
                    disabled={isConfirmPending}
                  >
                    <Text style={styles.modalConfirmText}>{confirmConfig?.confirmLabel}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={isUsageModalVisible} transparent animationType="fade" onRequestClose={closeUsageModal}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={[styles.modalTitle, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.updateUsageModalTitle}</Text>
                <Text style={[styles.modalSubtitle, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.updateUsageModalMessage}</Text>
                <TextInput
                  value={usageAmountInput}
                  onChangeText={setUsageAmountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  style={[styles.amountInput, isRtl ? styles.amountInputRtl : null]}
                  editable={!addUsageMutation.isPending}
                />
                <View style={[styles.modalActions, isRtl ? styles.rowReverse : null]}>
                  <Pressable style={styles.modalCancelButton} onPress={closeUsageModal} disabled={addUsageMutation.isPending}>
                    <Text style={styles.modalCancelText}>{copy.common.cancel}</Text>
                  </Pressable>
                  <Pressable style={styles.modalConfirmButton} onPress={handleSubmitUsageUpdate} disabled={addUsageMutation.isPending}>
                    <Text style={styles.modalConfirmText}>{addUsageMutation.isPending ? copy.common.saving : copy.common.save}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : null}
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
  detailsBox: {
    borderRadius: premiumTheme.radius.lg,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceStrong,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: premiumTheme.colors.border,
  },
  rowStack: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 14,
    color: premiumTheme.colors.mutedStrong,
    fontWeight: '700',
  },
  value: {
    fontSize: 15,
    color: premiumTheme.colors.text,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  valueRtl: {
    textAlign: 'left',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: premiumTheme.colors.muted,
  },
  notesLink: {
    color: premiumTheme.colors.accent,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  rowStackRtl: {
    alignItems: 'flex-end',
  },
  rowPressable: {
    backgroundColor: premiumTheme.colors.surfaceStrong,
  },
  attachmentValueGroup: {
    flexShrink: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  attachmentFileValue: {
    color: premiumTheme.colors.accent,
  },
  attachmentValueGroupRtl: {
    alignItems: 'flex-start',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
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
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
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
  deleteButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#e5c8c9',
  },
  deleteButtonText: {
    color: premiumTheme.colors.danger,
    fontWeight: '800',
  },
  errorText: {
    color: premiumTheme.colors.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 27, 42, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: premiumTheme.radius.xl,
    backgroundColor: premiumTheme.colors.surface,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: premiumTheme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: premiumTheme.colors.muted,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 16,
    color: premiumTheme.colors.text,
    backgroundColor: premiumTheme.colors.surfaceStrong,
  },
  amountInputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  modalCancelText: {
    color: premiumTheme.colors.mutedStrong,
    fontWeight: '800',
  },
  modalConfirmButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: premiumTheme.colors.accent,
    borderWidth: 1,
    borderColor: premiumTheme.colors.accentStrong,
  },
  modalConfirmButtonDestructive: {
    backgroundColor: premiumTheme.colors.danger,
    borderColor: '#a23f42',
  },
  modalConfirmText: {
    color: premiumTheme.colors.surfaceStrong,
    fontWeight: '800',
  },
});
