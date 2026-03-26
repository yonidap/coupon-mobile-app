import * as DocumentPicker from 'expo-document-picker';

import { attachmentsRepository } from '../repositories/attachmentsRepository';
import type { PickedAttachment, VoucherAttachment } from '../types/domain';
import { createLocalId } from '../utils/formatters';

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

export const attachmentService = {
  async pickAttachment(): Promise<PickedAttachment | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    return {
      localUri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
      sizeBytes: asset.size ?? null,
    };
  },

  async createAttachmentRecord(input: {
    voucherId: string;
    storageBucket: string;
    storagePath: string;
    kind: 'original' | 'preview' | 'ocr_source' | 'ocr_output';
    mimeType: string;
    fileName: string | null;
    fileSizeBytes: number | null;
    uploadedByUserId: string;
  }): Promise<VoucherAttachment> {
    return attachmentsRepository.createRecord(input);
  },

  async createSignedReadUrl(attachment: VoucherAttachment): Promise<string | null> {
    return attachmentsRepository.createSignedReadUrl(attachment);
  },

  async uploadVoucherAttachment(input: {
    walletId: string;
    voucherId: string;
    pickedAttachment: PickedAttachment;
    uploadedByUserId: string;
  }): Promise<VoucherAttachment> {
    const mimeType = resolveMimeType(input.pickedAttachment);
    const safeName = sanitizeFileName(input.pickedAttachment.name);
    const storagePath = `${input.walletId}/${input.voucherId}/${Date.now()}-${createLocalId('file')}-${safeName}`;

    const response = await fetch(input.pickedAttachment.localUri);
    const payload = await response.blob();

    await attachmentsRepository.uploadStorageObject({
      bucket: 'vouchers',
      path: storagePath,
      contentType: mimeType,
      payload,
    });

    return attachmentsRepository.createRecord({
      voucherId: input.voucherId,
      storageBucket: 'vouchers',
      storagePath,
      kind: 'original',
      mimeType,
      fileName: input.pickedAttachment.name,
      fileSizeBytes: input.pickedAttachment.sizeBytes,
      uploadedByUserId: input.uploadedByUserId,
    });
  },
};