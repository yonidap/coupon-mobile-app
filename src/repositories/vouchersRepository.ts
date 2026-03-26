import type { Voucher } from '../types/domain';
import { maybeGetSupabaseClient } from '../lib/supabase';
import { createLocalId } from '../utils/formatters';
import { isMissingRelationError } from '../utils/supabase';
import { attachmentsRepository } from './attachmentsRepository';

type VoucherUpsertInput = {
  voucherId?: string;
  walletId: string;
  createdByUserId: string;
  title: string;
  merchantName: string | null;
  category: string | null;
  faceValue: number | null;
  paidValue: number | null;
  currency: string;
  purchaseDate: string | null;
  expiryDate: string;
  code: string | null;
  notes: string | null;
};

const fallbackVoucherStore = new Map<string, Voucher[]>();

function mapVoucher(row: {
  id: string;
  wallet_id: string;
  created_by_user_id: string;
  title: string;
  merchant_name: string | null;
  category: string | null;
  face_value: number | null;
  paid_value: number | null;
  currency: string;
  purchase_date: string | null;
  expiry_date: string;
  code: string | null;
  notes: string | null;
  status: 'active' | 'redeemed' | 'expired' | 'archived';
  source_type: 'manual' | 'upload' | 'email_import' | 'ocr_import' | 'shared' | 'barcode_scan' | 'api';
  metadata: unknown;
  redeemed_at: string | null;
  created_at: string;
  updated_at: string;
}): Voucher {
  return {
    id: row.id,
    walletId: row.wallet_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    merchantName: row.merchant_name,
    category: row.category,
    faceValue: row.face_value,
    paidValue: row.paid_value,
    currency: row.currency,
    purchaseDate: row.purchase_date,
    expiryDate: row.expiry_date,
    code: row.code,
    notes: row.notes,
    status: row.status,
    source: row.source_type,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    redeemedAt: row.redeemed_at,
    attachments: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readFallbackVouchers(walletId: string): Voucher[] {
  return fallbackVoucherStore.get(walletId) ?? [];
}

function writeFallbackVouchers(walletId: string, vouchers: Voucher[]): Voucher[] {
  const next = [...vouchers].sort((left, right) => left.expiryDate.localeCompare(right.expiryDate));
  fallbackVoucherStore.set(walletId, next);
  return next;
}

function upsertFallbackVoucher(input: VoucherUpsertInput): Voucher {
  const now = new Date().toISOString();
  const voucherId = input.voucherId ?? createLocalId('voucher');
  const existing = readFallbackVouchers(input.walletId).find((item) => item.id === voucherId);

  const voucher: Voucher = {
    id: voucherId,
    walletId: input.walletId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    merchantName: input.merchantName,
    category: input.category,
    faceValue: input.faceValue,
    paidValue: input.paidValue,
    currency: input.currency,
    purchaseDate: input.purchaseDate,
    expiryDate: input.expiryDate,
    code: input.code,
    notes: input.notes,
    status: existing?.status ?? 'active',
    source: 'manual',
    metadata: {},
    redeemedAt: existing?.redeemedAt ?? null,
    attachments: existing?.attachments ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const current = readFallbackVouchers(input.walletId).filter((item) => item.id !== voucher.id);
  writeFallbackVouchers(input.walletId, [...current, voucher]);

  return voucher;
}

async function hydrateAttachments(vouchers: Voucher[]): Promise<Voucher[]> {
  const attachmentMap = await attachmentsRepository.listByVoucherIds(vouchers.map((voucher) => voucher.id));

  return vouchers.map((voucher) => ({
    ...voucher,
    attachments: attachmentMap.get(voucher.id) ?? [],
  }));
}

export const vouchersRepository = {
  async listByWallet(walletId: string): Promise<Voucher[]> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return readFallbackVouchers(walletId);
    }

    const { data, error } = await client.from('vouchers').select('*').eq('wallet_id', walletId).order('expiry_date', { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return readFallbackVouchers(walletId);
      }

      throw new Error(error.message);
    }

    return hydrateAttachments(data.map(mapVoucher));
  },

  async getById(walletId: string, voucherId: string): Promise<Voucher | null> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return readFallbackVouchers(walletId).find((voucher) => voucher.id === voucherId) ?? null;
    }

    const { data, error } = await client.from('vouchers').select('*').eq('wallet_id', walletId).eq('id', voucherId).maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return readFallbackVouchers(walletId).find((voucher) => voucher.id === voucherId) ?? null;
      }

      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const [voucher] = await hydrateAttachments([mapVoucher(data)]);
    return voucher;
  },

  async upsert(input: VoucherUpsertInput): Promise<Voucher> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return upsertFallbackVoucher(input);
    }

    const { data, error } = await client
      .from('vouchers')
      .upsert({
        id: input.voucherId,
        wallet_id: input.walletId,
        created_by_user_id: input.createdByUserId,
        title: input.title,
        merchant_name: input.merchantName,
        category: input.category,
        face_value: input.faceValue,
        paid_value: input.paidValue,
        currency: input.currency,
        purchase_date: input.purchaseDate,
        expiry_date: input.expiryDate,
        code: input.code,
        notes: input.notes,
        source_type: 'manual',
        metadata: {},
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return upsertFallbackVoucher(input);
      }

      throw new Error(error.message);
    }

    return mapVoucher(data);
  },

  async markRedeemed(walletId: string, voucherId: string): Promise<Voucher> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      const voucher = readFallbackVouchers(walletId).find((item) => item.id === voucherId);

      if (!voucher) {
        throw new Error('Voucher not found.');
      }

      const updated: Voucher = {
        ...voucher,
        status: 'redeemed',
        redeemedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const next = readFallbackVouchers(walletId).filter((item) => item.id !== voucherId);
      writeFallbackVouchers(walletId, [...next, updated]);

      return updated;
    }

    const { data, error } = await client
      .from('vouchers')
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_id', walletId)
      .eq('id', voucherId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const [voucher] = await hydrateAttachments([mapVoucher(data)]);
    return voucher;
  },

  async deleteById(walletId: string, voucherId: string): Promise<void> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      const next = readFallbackVouchers(walletId).filter((item) => item.id !== voucherId);
      writeFallbackVouchers(walletId, next);
      return;
    }

    const { error } = await client.from('vouchers').delete().eq('wallet_id', walletId).eq('id', voucherId);

    if (error) {
      throw new Error(error.message);
    }
  },
};
