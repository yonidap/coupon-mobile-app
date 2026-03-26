import type { Voucher } from '../../types/domain';
import { getTodayDateInput } from '../../utils/formatters';
import type { VoucherFormValues } from './schemas';

export function createVoucherFormDefaults(currency = 'ILS'): VoucherFormValues {
  return {
    title: '',
    merchantName: '',
    category: '',
    faceValue: '',
    paidValue: '',
    currency,
    purchaseDate: getTodayDateInput(),
    expiryDate: getTodayDateInput(),
    code: '',
    notes: '',
    attachment: undefined,
  };
}

export function mapVoucherToFormValues(voucher: Voucher): VoucherFormValues {
  return {
    title: voucher.title,
    merchantName: voucher.merchantName ?? '',
    category: voucher.category ?? '',
    faceValue: voucher.faceValue?.toString() ?? '',
    paidValue: voucher.paidValue?.toString() ?? '',
    currency: voucher.currency,
    purchaseDate: voucher.purchaseDate ?? '',
    expiryDate: voucher.expiryDate,
    code: voucher.code ?? '',
    notes: voucher.notes ?? '',
    attachment: undefined,
  };
}