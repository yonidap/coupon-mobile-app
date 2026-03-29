import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StyleProp, ViewStyle } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionCard } from '../components/SectionCard';
import { useAuthSession } from '../hooks/useAuthSession';
import { useAppLanguage } from '../hooks/useAppLanguage';
import {
  formatExpiresLabel,
  formatRemainingValueLabel,
  getCategoryLabel,
  getDaysLeftLabel,
  translateKnownMessage,
} from '../i18n/translations';
import { useAddVoucherUsageMutation, useDeleteVoucherMutation, useMarkVoucherRedeemedMutation, useVoucherList } from '../hooks/useVoucherQueries';
import type { RootStackParamList } from '../navigation/types';
import type { Voucher } from '../types/domain';
import { formatCurrency, formatDateLabel, getDaysUntilDate } from '../utils/formatters';
import { premiumTheme } from '../theme/premium';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type SectionKey = 'expiringSoon' | 'active' | 'redeemed' | 'expired';
type DropdownKind = 'sort' | 'category' | 'brand';
type SortDirection = 'oldest' | 'newest';
type VoucherDisplay = {
  title: string;
  category: string;
  emphasis: string;
  emphasisTone: 'value' | 'text';
  support: string | null;
  footnote: string | null;
};
type VoucherAction = {
  label: string;
  onPress: () => void;
  disabled: boolean;
  variant: 'accent' | 'soft';
};
type VoucherBadge = {
  label: string;
  tone: 'warning' | 'danger';
};
type RedeemedSummary = {
  primary: string;
  secondary: string;
  tertiary: string;
};
type VoucherRowProps = {
  voucher: Voucher;
  display: VoucherDisplay;
  action: VoucherAction | null;
  badge: VoucherBadge | null;
  isCompact: boolean;
  redeemedSummary: RedeemedSummary | null;
  onDeletePress?: () => void;
  deleteDisabled?: boolean;
  rowStyle?: StyleProp<ViewStyle>;
  onPress: () => void;
};
type DropdownOption = {
  value: string;
  label: string;
};
type DropdownConfig = {
  title: string;
  options: DropdownOption[];
};

const ALL_FILTER_OPTION = 'All';

function buildVoucherSearchText(voucher: Voucher) {
  const attachmentText = voucher.attachments
    .flatMap((attachment) => [
      attachment.id,
      attachment.kind,
      attachment.storageBucket,
      attachment.storagePath,
      attachment.fileName ?? '',
      attachment.mimeType,
      attachment.fileSizeBytes !== null ? String(attachment.fileSizeBytes) : '',
    ])
    .join(' ');

  return [
    voucher.id,
    voucher.walletId,
    voucher.createdByUserId,
    voucher.voucherType,
    voucher.title,
    voucher.productName ?? '',
    voucher.merchantName ?? '',
    voucher.category ?? '',
    voucher.faceValue !== null ? String(voucher.faceValue) : '',
    String(voucher.usedValue),
    voucher.remainingValue !== null ? String(voucher.remainingValue) : '',
    voucher.paidValue !== null ? String(voucher.paidValue) : '',
    voucher.currency,
    voucher.purchaseDate ?? '',
    voucher.expiryDate,
    voucher.code ?? '',
    voucher.notes ?? '',
    voucher.status,
    voucher.source,
    voucher.redeemedAt ?? '',
    voucher.createdAt,
    voucher.updatedAt,
    JSON.stringify(voucher.metadata),
    attachmentText,
  ]
    .join(' ')
    .toLowerCase();
}

function VoucherRow({ voucher, display, action, badge, isCompact, redeemedSummary, onDeletePress, deleteDisabled, rowStyle, onPress }: VoucherRowProps) {
  const { copy, isRtl } = useAppLanguage();
  const hoverProgress = useRef(new Animated.Value(0)).current;
  const isInteractive = voucher.status === 'active';
  const [isHovered, setHovered] = useState(false);
  const [isPressed, setPressed] = useState(false);

  function animateHover(toValue: number) {
    if (!isInteractive) {
      return;
    }

    Animated.spring(hoverProgress, {
      toValue,
      useNativeDriver: true,
      tension: 220,
      friction: 22,
    }).start();
  }

  const animatedRowStyle = isInteractive
    ? {
        transform: [
          {
            translateY: hoverProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -3],
            }),
          },
        ],
      }
    : null;
  const isHighlighted = isInteractive && (isHovered || isPressed);
  const hoverStyle = isHighlighted ? (badge?.tone === 'warning' ? styles.expiringSoonRowHovered : styles.voucherRowHovered) : null;
  const content = redeemedSummary ? (
    <View style={[styles.redeemedSummaryRow, isRtl ? styles.rowReverse : null]}>
      <Pressable style={styles.redeemedSummaryContent} onPress={onPress}>
        <Text numberOfLines={1} style={[styles.redeemedSummaryLine, isRtl ? styles.textRtl : null]}>
          <Text style={styles.voucherTitle}>{redeemedSummary.primary}</Text>
          <Text style={styles.voucherTitleSeparator}> • </Text>
          <Text style={styles.redeemedSummarySecondary}>{redeemedSummary.secondary}</Text>
          <Text style={styles.voucherTitleSeparator}> • </Text>
          <Text style={styles.voucherCategory}>{redeemedSummary.tertiary}</Text>
        </Text>
      </Pressable>
      {onDeletePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.voucherDetails.deleteVoucher}
          style={({ pressed }) => [
            styles.redeemedDeleteButton,
            pressed ? styles.redeemedDeleteButtonPressed : null,
            deleteDisabled ? styles.redeemedDeleteButtonDisabled : null,
          ]}
          onPress={onDeletePress}
          disabled={deleteDisabled}
        >
          <Text style={styles.redeemedDeleteButtonText}>×</Text>
        </Pressable>
      ) : null}
    </View>
  ) : (
    <>
      <View style={[styles.voucherHeaderRow, isRtl ? styles.rowReverse : null]}>
        <Text numberOfLines={1} style={[styles.voucherTitleLine, isRtl ? styles.textRtl : null]}>
          <Text style={styles.voucherTitle}>{display.title}</Text>
          <Text style={styles.voucherTitleSeparator}> • </Text>
          <Text style={styles.voucherCategory}>{display.category}</Text>
        </Text>
        {badge ? (
          <View
            style={[
              styles.statusBadge,
              badge.tone === 'warning' ? styles.statusBadgeWarning : null,
              badge.tone === 'danger' ? styles.statusBadgeDanger : null,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                badge.tone === 'warning' ? styles.statusBadgeTextWarning : null,
                badge.tone === 'danger' ? styles.statusBadgeTextDanger : null,
              ]}
            >
              {badge.label}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.voucherBodyRow, isRtl ? styles.rowReverse : null]}>
        <View style={styles.voucherMetaBlock}>
          <Text
            numberOfLines={1}
            style={[styles.voucherEmphasis, display.emphasisTone === 'value' ? styles.voucherEmphasisValue : styles.voucherEmphasisText, isRtl ? styles.textRtl : null]}
          >
            {display.emphasis}
          </Text>
          {!isCompact ? (
            <Text numberOfLines={1} style={[styles.voucherSupport, isRtl ? styles.textRtl : null]}>
              {display.support}
            </Text>
          ) : null}
          {!isCompact && display.footnote ? (
            <Text numberOfLines={1} style={[styles.voucherFootnote, isRtl ? styles.textRtl : null]}>
              {display.footnote}
            </Text>
          ) : null}
        </View>
        {action ? (
          <View style={[styles.voucherActionSlot, isRtl ? styles.voucherActionSlotRtl : null]}>
            <Pressable
              style={[styles.compactActionButton, action.variant === 'accent' ? styles.compactActionButtonAccent : styles.compactActionButtonSoft]}
              onPress={action.onPress}
              disabled={action.disabled}
            >
              <Text style={[styles.compactActionText, isRtl ? styles.textRtl : null, action.variant === 'accent' ? styles.compactActionTextAccent : styles.compactActionTextSoft]}>
                {action.label}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </>
  );

  if (redeemedSummary) {
    return (
      <Animated.View style={[styles.voucherRow, rowStyle, hoverStyle, animatedRowStyle]}>
        <View style={[styles.voucherContent, styles.voucherContentCompact]}>{content}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.voucherRow, rowStyle, hoverStyle, animatedRowStyle]}>
      <Pressable
        style={[styles.voucherContent, isCompact ? styles.voucherContentCompact : null]}
        onPress={onPress}
        onHoverIn={
          isInteractive
            ? () => {
                setHovered(true);
                animateHover(1);
              }
            : undefined
        }
        onHoverOut={
          isInteractive
            ? () => {
                setHovered(false);
                animateHover(0);
              }
            : undefined
        }
        onPressIn={
          isInteractive
            ? () => {
                setPressed(true);
                animateHover(1);
              }
            : undefined
        }
        onPressOut={
          isInteractive
            ? () => {
                setPressed(false);
                animateHover(0);
              }
            : undefined
        }
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuthSession();
  const { copy, language, locale, isRtl } = useAppLanguage();
  const { width } = useWindowDimensions();
  const vouchersQuery = useVoucherList(user?.id);
  const deleteMutation = useDeleteVoucherMutation(user?.id);
  const markRedeemedMutation = useMarkVoucherRedeemedMutation(user?.id);
  const addUsageMutation = useAddVoucherUsageMutation(user?.id);
  const vouchers = vouchersQuery.data?.vouchers ?? [];
  const [sortDirection, setSortDirection] = useState<SortDirection>('oldest');
  const [selectedCategory, setSelectedCategory] = useState(ALL_FILTER_OPTION);
  const [selectedBrand, setSelectedBrand] = useState(ALL_FILTER_OPTION);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFiltersCollapsed, setFiltersCollapsed] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKind | null>(null);
  const [usageVoucherId, setUsageVoucherId] = useState<string | null>(null);
  const [redeemVoucherId, setRedeemVoucherId] = useState<string | null>(null);
  const [deleteVoucherId, setDeleteVoucherId] = useState<string | null>(null);
  const [usageAmountInput, setUsageAmountInput] = useState('');
  const [isUsageModalVisible, setUsageModalVisible] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>({
    expiringSoon: false,
    active: false,
    redeemed: false,
    expired: false,
  });
  const isCompactFilterLayout = width < 460;

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(vouchers.map((voucher) => voucher.category ?? 'Other'))).sort((left, right) =>
      getCategoryLabel(left, language).localeCompare(getCategoryLabel(right, language), locale),
    );
    return [ALL_FILTER_OPTION, ...categories];
  }, [vouchers, language, locale]);

  const brandOptions = useMemo(() => {
    const brands = Array.from(new Set(vouchers.map((voucher) => voucher.merchantName?.trim() || 'No merchant'))).sort((left, right) =>
      left.localeCompare(right, locale),
    );
    return [ALL_FILTER_OPTION, ...brands];
  }, [vouchers, locale]);

  const activeDropdownConfig = useMemo<DropdownConfig | null>(() => {
    if (activeDropdown === 'sort') {
      return {
        title: copy.home.sortVouchers,
        options: [
          { value: 'oldest', label: copy.home.oldToNew },
          { value: 'newest', label: copy.home.newToOld },
        ],
      };
    }

    if (activeDropdown === 'category') {
      return {
        title: copy.home.filterByCategory,
        options: categoryOptions.map((option) => ({ value: option, label: option === ALL_FILTER_OPTION ? copy.common.all : getCategoryLabel(option, language) })),
      };
    }

    if (activeDropdown === 'brand') {
      return {
        title: copy.home.filterByBrand,
        options: brandOptions.map((option) => ({ value: option, label: option === ALL_FILTER_OPTION ? copy.common.all : option === 'No merchant' ? copy.common.noMerchant : option })),
      };
    }

    return null;
  }, [activeDropdown, categoryOptions, brandOptions, copy.common.all, copy.home.filterByBrand, copy.home.filterByCategory, copy.home.newToOld, copy.home.oldToNew, copy.home.sortVouchers, language]);

  const filteredVouchers = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const filtered = vouchers.filter((voucher) => {
      const voucherCategory = voucher.category ?? 'Other';
      const voucherBrand = voucher.merchantName?.trim() || 'No merchant';

      if (selectedCategory !== ALL_FILTER_OPTION && voucherCategory !== selectedCategory) {
        return false;
      }

      if (selectedBrand !== ALL_FILTER_OPTION && voucherBrand !== selectedBrand) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      return buildVoucherSearchText(voucher).includes(normalizedSearchTerm);
    });

    filtered.sort((left, right) =>
      sortDirection === 'oldest' ? left.expiryDate.localeCompare(right.expiryDate) : right.expiryDate.localeCompare(left.expiryDate),
    );

    return filtered;
  }, [vouchers, selectedCategory, selectedBrand, searchTerm, sortDirection]);

  const sections = useMemo(() => {
    const sorted = [...filteredVouchers];

    const expiringSoon = sorted.filter((voucher) => voucher.status === 'active' && getDaysUntilDate(voucher.expiryDate) >= 0 && getDaysUntilDate(voucher.expiryDate) <= 7);
    const active = sorted.filter((voucher) => voucher.status === 'active' && getDaysUntilDate(voucher.expiryDate) > 7);
    const redeemed = sorted.filter((voucher) => voucher.status === 'redeemed');
    const expired = sorted.filter((voucher) => voucher.status === 'expired' || (voucher.status !== 'redeemed' && getDaysUntilDate(voucher.expiryDate) < 0));

    return { expiringSoon, active, redeemed, expired };
  }, [filteredVouchers]);

  function getMonetaryDisplay(voucher: (typeof vouchers)[number]) {
    const remainingValue = voucher.remainingValue;
    const remainingLabel = formatCurrency(remainingValue, voucher.currency, { locale, missingLabel: copy.common.noValue });
    const expiryLabel = formatDateLabel(voucher.expiryDate, { locale, missingLabel: copy.common.notSet });

    return {
      title: voucher.merchantName || voucher.title,
      category: getCategoryLabel(voucher.category ?? 'Other', language),
      emphasis: formatRemainingValueLabel(remainingLabel, language),
      emphasisTone: 'value' as const,
      support: null,
      footnote: formatExpiresLabel(expiryLabel, language),
    };
  }

  function getProductDisplay(voucher: (typeof vouchers)[number]) {
    const expiryLabel = formatDateLabel(voucher.expiryDate, { locale, missingLabel: copy.common.notSet });

    return {
      title: voucher.productName || voucher.title,
      category: getCategoryLabel(voucher.category ?? 'Other', language),
      emphasis: voucher.merchantName || copy.common.noMerchant,
      emphasisTone: 'text' as const,
      support: formatExpiresLabel(expiryLabel, language),
      footnote: null,
    };
  }

  function getVoucherDisplay(voucher: (typeof vouchers)[number]) {
    if (voucher.voucherType === 'product') {
      return getProductDisplay(voucher);
    }

    return getMonetaryDisplay(voucher);
  }

  function getRedeemedSummary(voucher: (typeof vouchers)[number]) {
    const category = getCategoryLabel(voucher.category ?? 'Other', language);

    if (voucher.voucherType === 'product') {
      return {
        primary: voucher.productName || voucher.title,
        secondary: voucher.merchantName || copy.common.noMerchant,
        tertiary: category,
      };
    }

    return {
      primary: voucher.merchantName || voucher.title,
      secondary: voucher.faceValue !== null
        ? formatCurrency(voucher.faceValue, voucher.currency, { locale, missingLabel: copy.common.noValue })
        : copy.common.noValue,
      tertiary: category,
    };
  }

  const selectedUsageVoucher = usageVoucherId ? vouchers.find((voucher) => voucher.id === usageVoucherId) ?? null : null;
  const selectedRedeemVoucher = redeemVoucherId ? vouchers.find((voucher) => voucher.id === redeemVoucherId) ?? null : null;
  const selectedDeleteVoucher = deleteVoucherId ? vouchers.find((voucher) => voucher.id === deleteVoucherId) ?? null : null;
  const hasFilterControlsActive =
    sortDirection === 'newest' || selectedCategory !== ALL_FILTER_OPTION || selectedBrand !== ALL_FILTER_OPTION || searchTerm.trim().length > 0;

  function openDropdown(kind: DropdownKind) {
    setActiveDropdown(kind);
  }

  function closeDropdown() {
    setActiveDropdown(null);
  }

  function handleDropdownSelection(value: string) {
    if (activeDropdown === 'sort') {
      setSortDirection(value === 'newest' ? 'newest' : 'oldest');
    }

    if (activeDropdown === 'category') {
      setSelectedCategory(value);
    }

    if (activeDropdown === 'brand') {
      setSelectedBrand(value);
    }

    closeDropdown();
  }

  function clearFilters() {
    setSortDirection('oldest');
    setSelectedCategory(ALL_FILTER_OPTION);
    setSelectedBrand(ALL_FILTER_OPTION);
    setSearchTerm('');
  }

  function toggleFiltersCollapsed() {
    setFiltersCollapsed((current) => !current);
  }

  function openUsageModal(voucherId: string) {
    setUsageVoucherId(voucherId);
    setUsageAmountInput('');
    setUsageModalVisible(true);
  }

  function openRedeemModal(voucherId: string) {
    setRedeemVoucherId(voucherId);
  }

  function openDeleteModal(voucherId: string) {
    setDeleteVoucherId(voucherId);
  }

  function closeUsageModal() {
    if (addUsageMutation.isPending) {
      return;
    }

    setUsageModalVisible(false);
    setUsageVoucherId(null);
    setUsageAmountInput('');
  }

  function closeRedeemModal() {
    if (markRedeemedMutation.isPending) {
      return;
    }

    setRedeemVoucherId(null);
  }

  function closeDeleteModal() {
    if (deleteMutation.isPending) {
      return;
    }

    setDeleteVoucherId(null);
  }

  async function handleSubmitUsageUpdate() {
    if (!selectedUsageVoucher || selectedUsageVoucher.voucherType !== 'monetary' || selectedUsageVoucher.faceValue === null) {
      return;
    }

    const parsedAmount = Number(usageAmountInput.trim().replace(',', '.'));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(copy.common.invalidAmountTitle, copy.common.invalidAmountMessage);
      return;
    }

    try {
      await addUsageMutation.mutateAsync({
        voucherId: selectedUsageVoucher.id,
        amount: parsedAmount,
      });
      closeUsageModal();
      Alert.alert(copy.common.updatedTitle, copy.voucherDetails.usageUpdatedMessage);
    } catch (error) {
      console.error('[HomeScreen] Update usage failed:', error);
      const message = error instanceof Error ? translateKnownMessage(error.message, language) : copy.common.updateFailedTitle;
      Alert.alert(copy.common.updateFailedTitle, message);
    }
  }

  async function handleRedeemVoucher() {
    if (!selectedRedeemVoucher) {
      return;
    }

    try {
      await markRedeemedMutation.mutateAsync({ voucherId: selectedRedeemVoucher.id });
      setRedeemVoucherId(null);
      Alert.alert(copy.common.updatedTitle, copy.voucherDetails.markRedeemedMessage);
    } catch (error) {
      console.error('[HomeScreen] Redeem failed:', error);
      const message = error instanceof Error ? translateKnownMessage(error.message, language) : copy.common.updateFailedTitle;
      Alert.alert(copy.common.updateFailedTitle, message);
    }
  }

  async function handleDeleteVoucher() {
    if (!selectedDeleteVoucher) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ voucherId: selectedDeleteVoucher.id });
      setDeleteVoucherId(null);
    } catch (error) {
      console.error('[HomeScreen] Delete voucher failed:', error);
      const message = error instanceof Error ? translateKnownMessage(error.message, language) : copy.common.deleteFailedTitle;
      Alert.alert(copy.common.deleteFailedTitle, message);
    }
  }

  function getVoucherAction(voucher: (typeof vouchers)[number]) {
    if (voucher.status !== 'active') {
      return null;
    }

    if (voucher.voucherType === 'product') {
      return {
        label: markRedeemedMutation.isPending ? copy.home.redeeming : copy.home.redeem,
        onPress: () => openRedeemModal(voucher.id),
        disabled: markRedeemedMutation.isPending,
        variant: 'accent' as const,
      };
    }

    return {
      label: addUsageMutation.isPending && usageVoucherId === voucher.id ? copy.home.updating : copy.home.updateUsage,
      onPress: () => openUsageModal(voucher.id),
      disabled: addUsageMutation.isPending,
      variant: 'soft' as const,
    };
  }

  function getVoucherBadge(voucher: (typeof vouchers)[number]) {
    const daysUntilExpiry = getDaysUntilDate(voucher.expiryDate);

    if (voucher.status === 'redeemed') {
      return null;
    }

    if (voucher.status === 'expired' || daysUntilExpiry < 0) {
      return {
        label: copy.common.expired,
        tone: 'danger' as const,
      };
    }

    if (voucher.status === 'active' && daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
      return {
        label: getDaysLeftLabel(daysUntilExpiry, language),
        tone: 'warning' as const,
      };
    }

    return null;
  }

  function toggleSection(section: SectionKey) {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function renderSectionHeading(label: string, count: number, section: SectionKey) {
    const isCollapsed = collapsedSections[section];

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        style={({ pressed }) => [styles.sectionHeaderRow, isRtl ? styles.rowReverse : null, pressed ? styles.sectionHeaderPressed : null]}
        onPress={() => toggleSection(section)}
      >
        <View style={[styles.sectionHeaderTitleRow, isRtl ? styles.rowReverse : null]}>
          <Text style={[styles.sectionHeading, isRtl ? styles.labelRtl : null]}>{label}</Text>
          <View style={styles.sectionCountBadge}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        </View>
        <View style={styles.sectionChevronBadge}>
          <Text style={styles.sectionChevronText}>{isCollapsed ? '▸' : '▾'}</Text>
        </View>
      </Pressable>
    );
  }

  function renderVoucherRow(voucher: (typeof vouchers)[number], options?: { rowStyle?: object; compact?: boolean }) {
    const display = getVoucherDisplay(voucher);
    const action = getVoucherAction(voucher);
    const badge = getVoucherBadge(voucher);
    const isCompact = options?.compact ?? false;
    const redeemedSummary = isCompact && voucher.status === 'redeemed' ? getRedeemedSummary(voucher) : null;
    const deleteDisabled = deleteMutation.isPending && deleteVoucherId === voucher.id;

    return (
      <VoucherRow
        key={voucher.id}
        voucher={voucher}
        display={display}
        action={action}
        badge={badge}
        isCompact={isCompact}
        redeemedSummary={redeemedSummary}
        onDeletePress={redeemedSummary ? () => openDeleteModal(voucher.id) : undefined}
        deleteDisabled={redeemedSummary ? deleteDisabled : undefined}
        rowStyle={options?.rowStyle}
        onPress={() => navigation.navigate('VoucherDetails', { voucherId: voucher.id })}
      />
    );
  }

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={vouchersQuery.isRefetching} onRefresh={() => vouchersQuery.refetch()} />}>
      <SectionCard>
        <View style={[styles.walletHeaderRow, isRtl ? styles.rowReverse : null]}>
          <Text style={[styles.walletLabel, isRtl ? styles.textRtl : null]}>
            {vouchersQuery.data?.wallet.name && vouchersQuery.data.wallet.name !== 'My Wallet' ? vouchersQuery.data.wallet.name : copy.home.myWallet}
          </Text>
          <Pressable
            accessibilityLabel={copy.home.addVoucher}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addButton, pressed ? styles.addButtonPressed : null]}
            onPress={() => navigation.navigate('VoucherCreateEntry')}
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.filtersPanel}>
          <View style={[styles.searchRow, isRtl ? styles.rowReverse : null]}>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={copy.home.searchPlaceholder}
              placeholderTextColor={premiumTheme.colors.muted}
              style={[styles.searchInput, isRtl ? styles.searchInputRtl : null]}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFiltersCollapsed ? copy.common.showFilters : copy.common.hideFilters}
              style={({ pressed }) => [styles.collapseFiltersButton, pressed ? styles.collapseFiltersButtonPressed : null]}
              onPress={toggleFiltersCollapsed}
            >
              <Text style={styles.collapseFiltersIcon}>{isFiltersCollapsed ? '▴' : '▾'}</Text>
            </Pressable>
          </View>
          {!isFiltersCollapsed ? (
            <>
              <View style={[styles.dropdownRow, isRtl ? styles.rowReverse : null]}>
                <View style={styles.dropdownField}>
                  <Text style={[styles.dropdownFieldLabel, isCompactFilterLayout ? styles.dropdownFieldLabelCompact : null, isRtl ? styles.labelRtl : null]}>{copy.home.sort}</Text>
                  <Pressable style={styles.dropdownButton} onPress={() => openDropdown('sort')}>
                    <Text numberOfLines={1} style={[styles.dropdownValue, isRtl ? styles.textRtl : null]}>
                      {sortDirection === 'oldest' ? copy.home.oldToNew : copy.home.newToOld}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.dropdownField}>
                  <Text style={[styles.dropdownFieldLabel, isCompactFilterLayout ? styles.dropdownFieldLabelCompact : null, isRtl ? styles.labelRtl : null]}>{copy.home.category}</Text>
                  <Pressable style={styles.dropdownButton} onPress={() => openDropdown('category')}>
                    <Text numberOfLines={1} style={[styles.dropdownValue, isRtl ? styles.textRtl : null]}>
                      {selectedCategory === ALL_FILTER_OPTION ? copy.common.all : getCategoryLabel(selectedCategory, language)}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.dropdownField}>
                  <Text style={[styles.dropdownFieldLabel, isCompactFilterLayout ? styles.dropdownFieldLabelCompact : null, isRtl ? styles.labelRtl : null]}>{copy.home.brand}</Text>
                  <Pressable style={styles.dropdownButton} onPress={() => openDropdown('brand')}>
                    <Text numberOfLines={1} style={[styles.dropdownValue, isRtl ? styles.textRtl : null]}>
                      {selectedBrand === ALL_FILTER_OPTION ? copy.common.all : selectedBrand === 'No merchant' ? copy.common.noMerchant : selectedBrand}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {hasFilterControlsActive ? (
                <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
                  <Text style={styles.clearFiltersText}>{copy.common.clearFilters}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>
        {vouchersQuery.isLoading ? <ActivityIndicator color={premiumTheme.colors.accent} /> : null}
        {vouchersQuery.error ? <Text style={styles.errorText}>{copy.home.voucherLoadingFailed}</Text> : null}
        {!vouchersQuery.isLoading && !vouchersQuery.error && vouchers.length === 0 ? (
          <View style={styles.emptyStateBlock}>
            <EmptyState title={copy.home.noVouchersYetTitle} message={copy.home.noVouchersYetMessage} />
            <Pressable style={styles.emptyStateButton} onPress={() => navigation.navigate('VoucherCreateEntry')}>
              <Text style={styles.emptyStateButtonText}>{copy.home.noVouchersYetButton}</Text>
            </Pressable>
          </View>
        ) : null}
        {!vouchersQuery.isLoading && !vouchersQuery.error && vouchers.length > 0 && filteredVouchers.length === 0 ? (
          <View style={styles.emptyStateBlock}>
            <EmptyState title={copy.home.noMatchingVouchersTitle} message={copy.home.noMatchingVouchersMessage} />
            <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>{copy.common.resetSearchAndFilters}</Text>
            </Pressable>
          </View>
        ) : null}
        {filteredVouchers.length > 0 ? (
          <>
            {sections.expiringSoon.length > 0 ? renderSectionHeading(copy.home.expiringSoon, sections.expiringSoon.length, 'expiringSoon') : null}
            {!collapsedSections.expiringSoon ? sections.expiringSoon.map((voucher) => renderVoucherRow(voucher, { rowStyle: styles.expiringSoonRow })) : null}
            {sections.active.length > 0 ? renderSectionHeading(copy.home.active, sections.active.length, 'active') : null}
            {!collapsedSections.active ? sections.active.map((voucher) => renderVoucherRow(voucher)) : null}
            {sections.redeemed.length > 0 ? renderSectionHeading(copy.home.redeemed, sections.redeemed.length, 'redeemed') : null}
            {!collapsedSections.redeemed ? sections.redeemed.map((voucher) => renderVoucherRow(voucher, { compact: true })) : null}
            {sections.expired.length > 0 ? renderSectionHeading(copy.home.expiredSection, sections.expired.length, 'expired') : null}
            {!collapsedSections.expired ? sections.expired.map((voucher) => renderVoucherRow(voucher, { rowStyle: styles.expiredRow })) : null}
          </>
        ) : null}
      </SectionCard>

      <Modal visible={redeemVoucherId !== null} transparent animationType="fade" onRequestClose={closeRedeemModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, isRtl ? styles.textRtl : null]}>{copy.home.redeemVoucherTitle}</Text>
            <Text style={[styles.modalSubtitle, isRtl ? styles.textRtl : null]}>
              {selectedRedeemVoucher
                ? `${selectedRedeemVoucher.productName || selectedRedeemVoucher.title} ${copy.home.redeemedModalMessagePrefix}`
                : copy.home.redeemVoucherMessage}
            </Text>
            <View style={[styles.modalActions, isRtl ? styles.rowReverse : null]}>
              <Pressable style={styles.modalCancelButton} onPress={closeRedeemModal} disabled={markRedeemedMutation.isPending}>
                <Text style={styles.modalCancelText}>{copy.common.cancel}</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmButton} onPress={handleRedeemVoucher} disabled={markRedeemedMutation.isPending}>
                <Text style={styles.modalConfirmText}>{markRedeemedMutation.isPending ? copy.home.redeeming : copy.home.redeem}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={deleteVoucherId !== null} transparent animationType="fade" onRequestClose={closeDeleteModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.deleteVoucherTitle}</Text>
            {selectedDeleteVoucher ? (
              <Text style={[styles.modalEntityName, isRtl ? styles.textRtl : null]}>
                {selectedDeleteVoucher.productName || selectedDeleteVoucher.title}
              </Text>
            ) : null}
            <Text style={[styles.modalSubtitle, isRtl ? styles.textRtl : null]}>{copy.voucherDetails.deleteVoucherMessage}</Text>
            <View style={[styles.modalActions, isRtl ? styles.rowReverse : null]}>
              <Pressable style={styles.modalCancelButton} onPress={closeDeleteModal} disabled={deleteMutation.isPending}>
                <Text style={styles.modalCancelText}>{copy.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirmButton, styles.modalConfirmButtonDestructive]} onPress={handleDeleteVoucher} disabled={deleteMutation.isPending}>
                <Text style={styles.modalConfirmText}>{deleteMutation.isPending ? copy.common.deleting : copy.common.delete}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isUsageModalVisible} transparent animationType="fade" onRequestClose={closeUsageModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, isRtl ? styles.textRtl : null]}>{copy.home.updateUsageTitle}</Text>
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

      <Modal visible={activeDropdownConfig !== null} transparent animationType="fade" onRequestClose={closeDropdown}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dropdownModalCard}>
            <Text style={[styles.modalTitle, isRtl ? styles.textRtl : null]}>{activeDropdownConfig?.title}</Text>
            <ScrollView style={styles.dropdownModalList} contentContainerStyle={styles.dropdownModalListContent}>
              {activeDropdownConfig?.options.map((option) => {
                const currentValue =
                  activeDropdown === 'sort'
                    ? sortDirection
                    : activeDropdown === 'category'
                      ? selectedCategory
                      : selectedBrand;
                const isActive = currentValue === option.value;

                return (
                  <Pressable
                    key={option.value}
                    style={[styles.dropdownModalOption, isActive ? styles.dropdownModalOptionActive : null]}
                    onPress={() => handleDropdownSelection(option.value)}
                  >
                    <Text style={[styles.dropdownModalOptionText, isRtl ? styles.textRtl : null, isActive ? styles.dropdownModalOptionTextActive : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.modalActions, isRtl ? styles.rowReverse : null]}>
              <Pressable style={styles.modalCancelButton} onPress={closeDropdown}>
                <Text style={styles.modalCancelText}>{copy.common.close}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  walletLabel: {
    fontSize: 26,
    fontWeight: '900',
    color: premiumTheme.colors.text,
    letterSpacing: 0.2,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: premiumTheme.colors.accent,
    borderWidth: 1,
    borderColor: premiumTheme.colors.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  addButtonPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: premiumTheme.colors.accentStrong,
  },
  addButtonText: {
    color: premiumTheme.colors.surfaceStrong,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: -2,
  },
  filtersPanel: {
    gap: 10,
    borderRadius: premiumTheme.radius.md,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceStrong,
    padding: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surface,
    paddingHorizontal: 12,
    fontSize: 14,
    color: premiumTheme.colors.text,
  },
  searchInputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  collapseFiltersButton: {
    width: 40,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseFiltersButtonPressed: {
    backgroundColor: premiumTheme.colors.surfaceStrong,
    borderColor: premiumTheme.colors.borderStrong,
    transform: [{ scale: 0.97 }],
  },
  collapseFiltersIcon: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '900',
    color: premiumTheme.colors.mutedStrong,
    marginTop: -1,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownField: {
    flex: 1,
    gap: 4,
  },
  dropdownButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    justifyContent: 'center',
  },
  dropdownFieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: premiumTheme.colors.mutedStrong,
    textTransform: 'uppercase',
  },
  dropdownFieldLabelCompact: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  dropdownValue: {
    fontSize: 13,
    fontWeight: '800',
    color: premiumTheme.colors.accentStrong,
    lineHeight: 16,
    flexShrink: 1,
  },
  clearFiltersButton: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '800',
    color: premiumTheme.colors.mutedStrong,
  },
  dropdownModalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: premiumTheme.radius.xl,
    backgroundColor: premiumTheme.colors.surface,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  dropdownModalList: {
    flexGrow: 0,
  },
  dropdownModalListContent: {
    gap: 8,
  },
  dropdownModalOption: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  dropdownModalOptionActive: {
    backgroundColor: premiumTheme.colors.accentSoft,
    borderColor: premiumTheme.colors.accentStrong,
  },
  dropdownModalOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: premiumTheme.colors.text,
  },
  dropdownModalOptionTextActive: {
    color: premiumTheme.colors.accentStrong,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 32,
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  sectionHeaderPressed: {
    opacity: 0.72,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: premiumTheme.colors.mutedStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: premiumTheme.colors.mutedStrong,
  },
  sectionChevronBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    flexShrink: 0,
  },
  sectionChevronText: {
    fontSize: 12,
    fontWeight: '900',
    color: premiumTheme.colors.mutedStrong,
    marginTop: -1,
  },
  voucherRow: {
    borderRadius: premiumTheme.radius.lg,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: premiumTheme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
  },
  expiringSoonRow: {
    borderColor: '#d8b866',
    backgroundColor: '#fff5df',
  },
  expiringSoonRowHovered: {
    borderColor: '#c9a54a',
    backgroundColor: '#ffefc8',
  },
  expiredRow: {
    borderColor: '#e2c9c9',
    backgroundColor: '#f8eeee',
  },
  voucherRowHovered: {
    borderColor: premiumTheme.colors.borderStrong,
    backgroundColor: premiumTheme.colors.surfaceTint,
  },
  voucherContent: {
    gap: 7,
  },
  voucherContentCompact: {
    gap: 4,
  },
  redeemedSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  redeemedSummaryContent: {
    flex: 1,
  },
  voucherHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  voucherTitleLine: {
    fontSize: 16,
    lineHeight: 20,
    flex: 1,
  },
  redeemedSummaryLine: {
    fontSize: 16,
    lineHeight: 20,
  },
  voucherTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: premiumTheme.colors.text,
  },
  voucherTitleSeparator: {
    fontSize: 14,
    color: premiumTheme.colors.muted,
  },
  voucherCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: premiumTheme.colors.mutedStrong,
  },
  redeemedSummarySecondary: {
    fontSize: 13,
    fontWeight: '700',
    color: premiumTheme.colors.mutedStrong,
  },
  redeemedDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: premiumTheme.colors.danger,
    backgroundColor: premiumTheme.colors.dangerSoft,
    flexShrink: 0,
  },
  redeemedDeleteButtonPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: '#f6dede',
  },
  redeemedDeleteButtonDisabled: {
    opacity: 0.6,
  },
  redeemedDeleteButtonText: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '900',
    color: premiumTheme.colors.danger,
    marginTop: -1,
  },
  statusBadge: {
    minHeight: 20,
    borderRadius: 999,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  statusBadgeWarning: {
    backgroundColor: '#fff1cf',
    borderColor: '#e0bb63',
  },
  statusBadgeDanger: {
    backgroundColor: '#f8eeee',
    borderColor: '#e2c9c9',
  },
  statusBadgeNeutral: {
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderColor: premiumTheme.colors.border,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  statusBadgeTextWarning: {
    color: '#8a6918',
  },
  statusBadgeTextDanger: {
    color: premiumTheme.colors.danger,
  },
  statusBadgeTextNeutral: {
    color: premiumTheme.colors.mutedStrong,
  },
  voucherBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voucherMetaBlock: {
    flex: 1,
    gap: 2,
  },
  voucherEmphasis: {
    color: premiumTheme.colors.text,
  },
  voucherEmphasisValue: {
    fontSize: 15,
    fontWeight: '900',
    color: premiumTheme.colors.accentStrong,
  },
  voucherEmphasisText: {
    fontSize: 14,
    fontWeight: '700',
    color: premiumTheme.colors.text,
  },
  voucherSupport: {
    fontSize: 12,
    color: premiumTheme.colors.mutedStrong,
    lineHeight: 16,
  },
  voucherFootnote: {
    fontSize: 12,
    color: premiumTheme.colors.muted,
    lineHeight: 16,
  },
  voucherActionSlot: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  voucherActionSlotRtl: {
    alignItems: 'flex-start',
  },
  compactActionButton: {
    minHeight: 26,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  compactActionButtonAccent: {
    backgroundColor: premiumTheme.colors.accentSoft,
    borderColor: premiumTheme.colors.borderStrong,
  },
  compactActionButtonSoft: {
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderColor: premiumTheme.colors.border,
  },
  compactActionText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  compactActionTextAccent: {
    color: premiumTheme.colors.accentStrong,
  },
  compactActionTextSoft: {
    color: premiumTheme.colors.mutedStrong,
  },
  emptyStateBlock: {
    gap: 12,
  },
  emptyStateButton: {
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.accent,
    borderWidth: 1,
    borderColor: premiumTheme.colors.accentStrong,
  },
  emptyStateButtonText: {
    color: premiumTheme.colors.surfaceStrong,
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
    lineHeight: 20,
    color: premiumTheme.colors.muted,
  },
  modalEntityName: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    color: premiumTheme.colors.text,
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
    borderColor: '#c63f3f',
  },
  modalConfirmText: {
    color: premiumTheme.colors.surfaceStrong,
    fontWeight: '800',
  },
});
