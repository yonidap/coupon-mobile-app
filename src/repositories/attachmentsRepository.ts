import type { VoucherAttachment } from '../types/domain';
import { maybeGetSupabaseClient } from '../lib/supabase';
import { createLocalId } from '../utils/formatters';
import { isMissingRelationError } from '../utils/supabase';

// NOTE: kind values match the SQL check constraint on voucher_attachments.kind.
type AttachmentKindSql = 'original' | 'preview' | 'ocr_source' | 'ocr_output';

type CreateAttachmentInput = {
  voucherId: string;
  storageBucket: string;
  storagePath: string;
  kind: AttachmentKindSql;
  mimeType: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  uploadedByUserId: string;
};

function mapAttachment(row: {
  id: string;
  voucher_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string;
  file_size_bytes: number | null;
  uploaded_by_user_id: string;
  kind: AttachmentKindSql;
  created_at: string;
}): VoucherAttachment {
  return {
    id: row.id,
    voucherId: row.voucher_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadedByUserId: row.uploaded_by_user_id,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

function buildLocalAttachment(input: CreateAttachmentInput): VoucherAttachment {
  return {
    id: createLocalId('attachment'),
    voucherId: input.voucherId,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    uploadedByUserId: input.uploadedByUserId,
    kind: input.kind,
    createdAt: new Date().toISOString(),
  };
}

export const attachmentsRepository = {
  async listByVoucher(voucherId: string): Promise<VoucherAttachment[]> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return [];
    }

    const { data, error } = await client.from('voucher_attachments').select('*').eq('voucher_id', voucherId).order('created_at');

    if (error) {
      if (isMissingRelationError(error)) {
        return [];
      }

      throw new Error(error.message);
    }

    return data.map(mapAttachment);
  },

  async listByVoucherIds(voucherIds: string[]): Promise<Map<string, VoucherAttachment[]>> {
    const grouped = new Map<string, VoucherAttachment[]>();

    if (voucherIds.length === 0) {
      return grouped;
    }

    const client = maybeGetSupabaseClient();

    if (!client) {
      return grouped;
    }

    const { data, error } = await client
      .from('voucher_attachments')
      .select('*')
      .in('voucher_id', voucherIds)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return grouped;
      }

      throw new Error(error.message);
    }

    for (const row of data) {
      const attachment = mapAttachment(row);
      const existing = grouped.get(attachment.voucherId) ?? [];
      grouped.set(attachment.voucherId, [...existing, attachment]);
    }

    return grouped;
  },

  async uploadStorageObject(input: {
    bucket: string;
    path: string;
    contentType: string;
    payload: Blob;
  }): Promise<void> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return;
    }

    const { error } = await client.storage.from(input.bucket).upload(input.path, input.payload, {
      upsert: false,
      contentType: input.contentType,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async createRecord(input: CreateAttachmentInput): Promise<VoucherAttachment> {
    const client = maybeGetSupabaseClient();
    const fallbackAttachment = buildLocalAttachment(input);

    if (!client) {
      return fallbackAttachment;
    }

    const { data, error } = await client
      .from('voucher_attachments')
      .insert({
        voucher_id: input.voucherId,
        storage_bucket: input.storageBucket,
        storage_path: input.storagePath,
        kind: input.kind,
        mime_type: input.mimeType,
        file_name: input.fileName,
        file_size_bytes: input.fileSizeBytes,
        uploaded_by_user_id: input.uploadedByUserId,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return fallbackAttachment;
      }

      throw new Error(error.message);
    }

    return mapAttachment(data);
  },

  async createSignedReadUrl(attachment: VoucherAttachment): Promise<string | null> {
    const client = maybeGetSupabaseClient();

    if (!client || !attachment.storagePath) {
      return null;
    }

    // TODO: keep voucher attachment storage private-by-default and serve only short-lived signed URLs.
    const { data, error } = await client.storage.from(attachment.storageBucket).createSignedUrl(attachment.storagePath, 60 * 5);

    if (error) {
      throw new Error(error.message);
    }

    return data.signedUrl;
  },
};