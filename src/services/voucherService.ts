import { vouchersRepository } from '../repositories/vouchersRepository';
import type { VoucherFormValues } from '../features/vouchers/schemas';
import { duplicateVoucherCodeErrorMessage } from '../features/vouchers/errors';
import { walletsService } from './walletsService';
import { attachmentService } from './attachmentService';

type SaveVoucherInput = {
  userId: string;
  voucherId?: string;
  values: VoucherFormValues;
};

function buildVoucherTitle(values: VoucherFormValues): string {
  if (values.voucherType === 'product') {
    return values.productName.trim();
  }

  return `${values.merchantName.trim()} voucher`;
}

function parseOptionalAmount(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export const voucherService = {
  async listForUser(userId: string) {
    const wallet = await walletsService.getActiveWallet(userId);
    const vouchers = await vouchersRepository.listByWallet(wallet.id);

    return {
      wallet,
      vouchers,
    };
  },

  async getVoucher(userId: string, voucherId: string) {
    const wallet = await walletsService.getActiveWallet(userId);
    const voucher = await vouchersRepository.getById(wallet.id, voucherId);

    return {
      wallet,
      voucher,
    };
  },

  async saveVoucher({ userId, voucherId, values }: SaveVoucherInput) {
    const wallet = await walletsService.getActiveWallet(userId);
    if (await vouchersRepository.hasDuplicateCode(wallet.id, values.code, voucherId)) {
      throw new Error(duplicateVoucherCodeErrorMessage);
    }

    const faceValue = values.voucherType === 'monetary' ? parseOptionalAmount(values.faceValue) : null;
    const usedValue = values.voucherType === 'monetary' ? parseOptionalAmount(values.usedValue) ?? 0 : 0;

    const savedVoucher = await vouchersRepository.upsert({
      voucherId,
      walletId: wallet.id,
      createdByUserId: userId,
      title: buildVoucherTitle(values),
      voucherType: values.voucherType,
      productName: values.voucherType === 'product' ? values.productName.trim() : null,
      merchantName: values.merchantName.trim() || null,
      category: values.category,
      faceValue,
      usedValue,
      paidValue: null,
      currency: values.currency,
      purchaseDate: null,
      expiryDate: values.expiryDate,
      code: values.code || null,
      notes: values.notes || null,
    });

    if (values.attachment) {
      await attachmentService.uploadVoucherAttachment({
        walletId: wallet.id,
        voucherId: savedVoucher.id,
        pickedAttachment: values.attachment,
        uploadedByUserId: userId,
      });
    }

    return vouchersRepository.getById(wallet.id, savedVoucher.id).then((voucher) => {
      if (!voucher) {
        throw new Error('Voucher was saved, but it could not be reloaded.');
      }

      return voucher;
    });
  },

  async deleteVoucher(userId: string, voucherId: string): Promise<void> {
    const wallet = await walletsService.getActiveWallet(userId);
    await vouchersRepository.deleteById(wallet.id, voucherId);
  },

  async markVoucherRedeemed(userId: string, voucherId: string) {
    const wallet = await walletsService.getActiveWallet(userId);
    const voucher = await vouchersRepository.getById(wallet.id, voucherId);

    if (!voucher) {
      throw new Error('Voucher not found.');
    }

    return vouchersRepository.markRedeemed(wallet.id, voucherId);
  },

  async addVoucherUsage(userId: string, voucherId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Usage amount must be greater than zero.');
    }

    const wallet = await walletsService.getActiveWallet(userId);
    const voucher = await vouchersRepository.getById(wallet.id, voucherId);

    if (!voucher) {
      throw new Error('Voucher not found.');
    }

    if (voucher.voucherType !== 'monetary' || voucher.faceValue === null) {
      throw new Error('Usage updates are supported only for monetary vouchers.');
    }

    const nextUsedValue = Math.min(voucher.usedValue + amount, voucher.faceValue);
    return vouchersRepository.updateMonetaryUsage(wallet.id, voucherId, nextUsedValue);
  },
};
