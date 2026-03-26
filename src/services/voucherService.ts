import { vouchersRepository } from '../repositories/vouchersRepository';
import type { VoucherFormValues } from '../features/vouchers/schemas';
import { walletsService } from './walletsService';
import { attachmentService } from './attachmentService';

type SaveVoucherInput = {
  userId: string;
  voucherId?: string;
  values: VoucherFormValues;
};

function parseOptionalAmount(value: string): number | null {
  const trimmed = value.trim();

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
    const faceValue = parseOptionalAmount(values.faceValue);
    const paidValue = parseOptionalAmount(values.paidValue);

    const savedVoucher = await vouchersRepository.upsert({
      voucherId,
      walletId: wallet.id,
      createdByUserId: userId,
      title: values.title,
      merchantName: values.merchantName || null,
      category: values.category || null,
      faceValue,
      paidValue,
      currency: values.currency,
      purchaseDate: values.purchaseDate || null,
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
    return vouchersRepository.markRedeemed(wallet.id, voucherId);
  },
};