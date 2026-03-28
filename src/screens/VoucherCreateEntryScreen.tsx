import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { useAppLanguage } from '../hooks/useAppLanguage';
import type { RootStackParamList } from '../navigation/types';
import { premiumTheme } from '../theme/premium';

type Props = NativeStackScreenProps<RootStackParamList, 'VoucherCreateEntry'>;
type VoucherType = 'monetary' | 'product';

export function VoucherCreateEntryScreen({ navigation }: Props) {
  const { copy, isRtl } = useAppLanguage();
  const [showUploadTypePicker, setShowUploadTypePicker] = useState(false);
  const [selectedType, setSelectedType] = useState<VoucherType>('monetary');

  function startManualCreate() {
    navigation.navigate('VoucherForm', { createMode: 'manual' });
  }

  function startUploadFlow() {
    setShowUploadTypePicker(true);
  }

  function continueUploadFlow() {
    navigation.navigate('VoucherForm', {
      createMode: 'upload',
      initialVoucherType: selectedType,
      autoPickAttachment: true,
    });
  }

  return (
    <ScreenContainer>
      <SectionCard>
        <Text style={[styles.title, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.title}</Text>
        <Text style={[styles.subtitle, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.subtitle}</Text>

        <Pressable style={styles.optionButton} onPress={startUploadFlow}>
          <Text style={[styles.optionTitle, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.uploadFromFile}</Text>
          <Text style={[styles.optionHint, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.uploadFromFileHint}</Text>
        </Pressable>

        <Pressable style={styles.optionButton} onPress={startManualCreate}>
          <Text style={[styles.optionTitle, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.createManually}</Text>
          <Text style={[styles.optionHint, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.createManuallyHint}</Text>
        </Pressable>

        {showUploadTypePicker ? (
          <View style={styles.uploadTypeWrap}>
            <Text style={[styles.uploadTypeTitle, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.chooseTypeTitle}</Text>
            <Text style={[styles.uploadTypeHint, isRtl ? styles.textRtl : null]}>{copy.voucherEntry.chooseTypeHint}</Text>

            <View style={[styles.typeRow, isRtl ? styles.rowReverse : null]}>
              <Pressable
                style={[styles.typeChip, selectedType === 'monetary' ? styles.typeChipActive : null]}
                onPress={() => setSelectedType('monetary')}
              >
                <Text style={[styles.typeChipText, selectedType === 'monetary' ? styles.typeChipTextActive : null]}>{copy.voucherForm.money}</Text>
              </Pressable>
              <Pressable
                style={[styles.typeChip, selectedType === 'product' ? styles.typeChipActive : null]}
                onPress={() => setSelectedType('product')}
              >
                <Text style={[styles.typeChipText, selectedType === 'product' ? styles.typeChipTextActive : null]}>{copy.voucherForm.product}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.primaryButton} onPress={continueUploadFlow}>
              <Text style={styles.primaryButtonText}>{copy.voucherEntry.continueButton}</Text>
            </Pressable>
          </View>
        ) : null}
      </SectionCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: premiumTheme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: premiumTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  optionButton: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: premiumTheme.colors.borderStrong,
    backgroundColor: premiumTheme.colors.surfaceTint,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  optionTitle: {
    color: premiumTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  optionHint: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  uploadTypeWrap: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: premiumTheme.colors.border,
    gap: 8,
  },
  uploadTypeTitle: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  uploadTypeHint: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  typeChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: premiumTheme.colors.borderStrong,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: premiumTheme.colors.surfaceTint,
  },
  typeChipActive: {
    borderColor: premiumTheme.colors.accent,
    backgroundColor: premiumTheme.colors.accentSoft,
  },
  typeChipText: {
    color: premiumTheme.colors.muted,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: premiumTheme.colors.accent,
  },
  primaryButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: premiumTheme.colors.accent,
  },
  primaryButtonText: {
    color: premiumTheme.colors.surfaceStrong,
    fontSize: 14,
    fontWeight: '800',
  },
  textRtl: {
    textAlign: 'right',
  },
});
