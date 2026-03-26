import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../components/EmptyState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { FamilyWalletPlaceholder } from '../features/wallets/FamilyWalletPlaceholder';
import { useAuthSession } from '../hooks/useAuthSession';
import { useVoucherList } from '../hooks/useVoucherQueries';
import type { RootStackParamList } from '../navigation/types';
import { authService } from '../services/authService';
import { formatCurrency, formatDateLabel, getDaysUntilDate } from '../utils/formatters';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuthSession();
  const vouchersQuery = useVoucherList(user?.id);
  const vouchers = vouchersQuery.data?.vouchers ?? [];

  const sections = useMemo(() => {
    const sorted = [...vouchers].sort((left, right) => left.expiryDate.localeCompare(right.expiryDate));

    const expiringSoon = sorted.filter((voucher) => voucher.status === 'active' && getDaysUntilDate(voucher.expiryDate) >= 0 && getDaysUntilDate(voucher.expiryDate) <= 7);
    const active = sorted.filter((voucher) => voucher.status === 'active' && getDaysUntilDate(voucher.expiryDate) > 7);
    const redeemed = sorted.filter((voucher) => voucher.status === 'redeemed');
    const expired = sorted.filter((voucher) => voucher.status === 'expired' || (voucher.status !== 'redeemed' && getDaysUntilDate(voucher.expiryDate) < 0));

    return { expiringSoon, active, redeemed, expired };
  }, [vouchers]);

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={vouchersQuery.isRefetching} onRefresh={() => vouchersQuery.refetch()} />}>
      <SectionCard title="Wallet overview" subtitle="The MVP keeps a single personal wallet active, while shared wallet support stays behind repository boundaries.">
        <Text style={styles.walletLabel}>{vouchersQuery.data?.wallet.name ?? 'My Wallet'}</Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('VoucherForm')}>
            <Text style={styles.primaryButtonText}>Add voucher</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.secondaryButtonText}>Settings</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => authService.signOut()}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </SectionCard>

      <FamilyWalletPlaceholder />

      <SectionCard title="Vouchers" subtitle="Sorted by expiry date and grouped by urgency to keep expiring items visible.">
        {vouchersQuery.isLoading ? <ActivityIndicator color="#1f5f4d" /> : null}
        {vouchersQuery.error ? <Text style={styles.errorText}>We could not load vouchers right now. Pull to refresh and try again.</Text> : null}
        {!vouchersQuery.isLoading && !vouchersQuery.error && vouchers.length === 0 ? (
          <EmptyState title="No vouchers yet" message="Create your first voucher to start tracking expiry reminders." />
        ) : null}

        {sections.expiringSoon.length > 0 ? <Text style={styles.sectionHeading}>Expiring Soon</Text> : null}
        {sections.expiringSoon.map((voucher) => (
          <Pressable key={voucher.id} style={[styles.voucherRow, styles.expiringSoonRow]} onPress={() => navigation.navigate('VoucherDetails', { voucherId: voucher.id })}>
            <View style={styles.voucherMeta}>
              <Text style={styles.voucherTitle}>{voucher.title}</Text>
              <Text style={styles.voucherSubtitle}>{voucher.merchantName || 'No merchant'} · Expires {formatDateLabel(voucher.expiryDate)}</Text>
            </View>
            <Text style={styles.voucherValue}>{formatCurrency(voucher.faceValue ?? voucher.paidValue, voucher.currency)}</Text>
          </Pressable>
        ))}

        {sections.active.length > 0 ? <Text style={styles.sectionHeading}>Active</Text> : null}
        {sections.active.map((voucher) => (
          <Pressable key={voucher.id} style={styles.voucherRow} onPress={() => navigation.navigate('VoucherDetails', { voucherId: voucher.id })}>
            <View style={styles.voucherMeta}>
              <Text style={styles.voucherTitle}>{voucher.title}</Text>
              <Text style={styles.voucherSubtitle}>{voucher.merchantName || 'No merchant'} · Expires {formatDateLabel(voucher.expiryDate)}</Text>
            </View>
            <Text style={styles.voucherValue}>{formatCurrency(voucher.faceValue ?? voucher.paidValue, voucher.currency)}</Text>
          </Pressable>
        ))}

        {sections.redeemed.length > 0 ? <Text style={styles.sectionHeading}>Redeemed</Text> : null}
        {sections.redeemed.map((voucher) => (
          <Pressable key={voucher.id} style={styles.voucherRow} onPress={() => navigation.navigate('VoucherDetails', { voucherId: voucher.id })}>
            <View style={styles.voucherMeta}>
              <Text style={styles.voucherTitle}>{voucher.title}</Text>
              <Text style={styles.voucherSubtitle}>Redeemed {formatDateLabel(voucher.redeemedAt)}</Text>
            </View>
            <Text style={styles.voucherValue}>{formatCurrency(voucher.faceValue ?? voucher.paidValue, voucher.currency)}</Text>
          </Pressable>
        ))}

        {sections.expired.length > 0 ? <Text style={styles.sectionHeading}>Expired</Text> : null}
        {sections.expired.map((voucher) => (
          <Pressable key={voucher.id} style={[styles.voucherRow, styles.expiredRow]} onPress={() => navigation.navigate('VoucherDetails', { voucherId: voucher.id })}>
            <View style={styles.voucherMeta}>
              <Text style={styles.voucherTitle}>{voucher.title}</Text>
              <Text style={styles.voucherSubtitle}>Expired on {formatDateLabel(voucher.expiryDate)}</Text>
            </View>
            <Text style={styles.voucherValue}>{formatCurrency(voucher.faceValue ?? voucher.paidValue, voucher.currency)}</Text>
          </Pressable>
        ))}
      </SectionCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  walletLabel: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17231f',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#1f5f4d',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    backgroundColor: '#e4ece8',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#173029',
    fontWeight: '700',
  },
  voucherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f6f9f8',
    borderWidth: 1,
    borderColor: '#d8e4df',
  },
  expiringSoonRow: {
    borderColor: '#f0c86a',
    backgroundColor: '#fff8e8',
  },
  expiredRow: {
    borderColor: '#e6d3d3',
    backgroundColor: '#fbf2f2',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#556760',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  voucherMeta: {
    flex: 1,
    gap: 4,
  },
  voucherTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17231f',
  },
  voucherSubtitle: {
    fontSize: 13,
    color: '#556760',
    lineHeight: 18,
  },
  voucherValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f5f4d',
  },
  errorText: {
    color: '#b94b4b',
  },
});