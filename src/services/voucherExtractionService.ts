import { voucherExtractionRepository } from '../repositories/voucherExtractionRepository';
import type { PickedAttachment, VoucherDraftExtractionResult } from '../types/domain';
import { createLocalId } from '../utils/formatters';
import { walletsService } from './walletsService';

const MAX_INLINE_UPLOAD_BYTES = 4 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveMimeType(attachment: PickedAttachment): string {
  if (attachment.mimeType) {
    return attachment.mimeType;
  }

  const lower = attachment.name.toLowerCase();

  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (lower.endsWith('.png')) {
    return 'image/png';
  }

  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  return 'application/octet-stream';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read attachment content.'));
    };

    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Failed to encode attachment content.'));
        return;
      }

      const markerIndex = result.indexOf('base64,');

      if (markerIndex === -1) {
        reject(new Error('Invalid attachment base64 payload.'));
        return;
      }

      resolve(result.slice(markerIndex + 'base64,'.length));
    };

    reader.readAsDataURL(blob);
  });
}

export const voucherExtractionService = {
  async suggestVoucherDraft(input: { userId: string; attachment: PickedAttachment }): Promise<VoucherDraftExtractionResult> {
    const wallet = await walletsService.getActiveWallet(input.userId);
    const mimeType = resolveMimeType(input.attachment);
    const response = await fetch(input.attachment.localUri);
    const payload = await response.blob();

    if (payload.size <= MAX_INLINE_UPLOAD_BYTES) {
      const fileBase64 = await blobToBase64(payload);

      return await voucherExtractionRepository.extractDraft({
        walletId: wallet.id,
        fileName: input.attachment.name,
        mimeType,
        fileBase64,
      });
    }

    const safeFileName = sanitizeFileName(input.attachment.name);
    const storageBucket = 'vouchers';
    const storagePath = `intake/${wallet.id}/${input.userId}/${Date.now()}-${createLocalId('extract')}-${safeFileName}`;

    await voucherExtractionRepository.uploadIntakeObject({
      bucket: storageBucket,
      path: storagePath,
      contentType: mimeType,
      payload,
    });

    try {
      return await voucherExtractionRepository.extractDraft({
        walletId: wallet.id,
        storageBucket,
        storagePath,
        fileName: input.attachment.name,
        mimeType,
      });
    } finally {
      await voucherExtractionRepository.removeIntakeObject({
        bucket: storageBucket,
        path: storagePath,
      });
    }
  },
};
