import type { Voucher } from '../../types/domain';
import { getTodayDateInput } from '../../utils/formatters';
import { defaultVoucherCategory } from './categories';
import type { VoucherFormValues } from './schemas';

export function createVoucherFormDefaults(currency = 'ILS'): VoucherFormValues {
  return {
    voucherType: 'monetary',
    category: defaultVoucherCategory,
    productName: '',
    merchantName: '',
    faceValue: '',
    usedValue: '0',
    currency,
    purchaseDate: '',
    expiryDate: getTodayDateInput(),
    code: '',
    notes: '',
    attachment: undefined,
  };
}

export function mapVoucherToFormValues(voucher: Voucher): VoucherFormValues {
  return {
    voucherType: voucher.voucherType,
    category: voucher.category ?? defaultVoucherCategory,
    productName: voucher.productName ?? '',
    merchantName: voucher.merchantName ?? '',
    faceValue: voucher.faceValue?.toString() ?? '',
    usedValue: voucher.usedValue?.toString() ?? '0',
    currency: voucher.currency,
    purchaseDate: voucher.purchaseDate ?? '',
    expiryDate: voucher.expiryDate,
    code: voucher.code ?? '',
    notes: voucher.notes ?? '',
    attachment: undefined,
  };
}
