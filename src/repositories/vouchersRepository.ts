import type { Voucher } from '../types/domain';
import type { VoucherCategory } from '../features/vouchers/categories';
import { maybeGetSupabaseClient } from '../lib/supabase';
import { createLocalId } from '../utils/formatters';
import { isMissingRelationError } from '../utils/supabase';
import { attachmentsRepository } from './attachmentsRepository';

type VoucherUpsertInput = {
  voucherId?: string;
  walletId: string;
  createdByUserId: string;
  title: string;
  voucherType: 'monetary' | 'product';
  productName: string | null;
  merchantName: string | null;
  category: VoucherCategory;
  faceValue: number | null;
  usedValue: number;
  paidValue: number | null;
  currency: string;
  purchaseDate: string | null;
  expiryDate: string;
  code: string | null;
  updateCode?: boolean;
  notes: string | null;
};

const fallbackVoucherStore = new Map<string, Voucher[]>();

function normalizeVoucherCode(code: string | null | undefined): string | null {
  const trimmed = code?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
}

function mapVoucher(row: {
  id: string;
  wallet_id: string;
  created_by_user_id: string;
  voucher_type: 'monetary' | 'product' | null;
  title: string;
  product_name: string | null;
  merchant_name: string | null;
  category: VoucherCategory | null;
  face_value: number | null;
  used_value: number | null;
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
  const voucherType = row.voucher_type ?? 'monetary';
  const usedValue = row.used_value ?? 0;
  const remainingValue = voucherType === 'monetary' && row.face_value !== null ? Math.max(row.face_value - usedValue, 0) : null;

  return {
    id: row.id,
    walletId: row.wallet_id,
    createdByUserId: row.created_by_user_id,
    voucherType,
    title: row.title,
    productName: row.product_name,
    merchantName: row.merchant_name,
    category: row.category,
    faceValue: row.face_value,
    usedValue,
    remainingValue,
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
    voucherType: input.voucherType,
    title: input.title,
    productName: input.productName,
    merchantName: input.merchantName,
    category: input.category,
    faceValue: input.faceValue,
    usedValue: input.usedValue,
    remainingValue: input.voucherType === 'monetary' && input.faceValue !== null ? Math.max(input.faceValue - input.usedValue, 0) : null,
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

async function loadVouchersForCodeCheck(walletId: string): Promise<Voucher[]> {
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

  return data.map(mapVoucher);
}

export const vouchersRepository = {
  async hasDuplicateCode(walletId: string, code: string, excludeVoucherId?: string): Promise<boolean> {
    const normalizedTarget = normalizeVoucherCode(code);

    if (!normalizedTarget) {
      return false;
    }

    const vouchers = await loadVouchersForCodeCheck(walletId);

    return vouchers.some((voucher) => voucher.id !== excludeVoucherId && normalizeVoucherCode(voucher.code) === normalizedTarget);
  },

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
    const shouldUpdateCode = input.updateCode ?? true;

    if (!client) {
      if (input.voucherId && !shouldUpdateCode) {
        const existing = readFallbackVouchers(input.walletId).find((voucher) => voucher.id === input.voucherId);
        return upsertFallbackVoucher({
          ...input,
          code: existing?.code ?? input.code,
        });
      }

      return upsertFallbackVoucher(input);
    }

    if (!input.voucherId) {
      const { data, error } = await client
        .from('vouchers')
        .insert({
          wallet_id: input.walletId,
          created_by_user_id: input.createdByUserId,
          voucher_type: input.voucherType,
          title: input.title,
          product_name: input.productName,
          merchant_name: input.merchantName,
          category: input.category,
          face_value: input.faceValue,
          used_value: input.usedValue,
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
    }

    const updatePayload: {
      voucher_type: VoucherUpsertInput['voucherType'];
      title: string;
      product_name: string | null;
      merchant_name: string | null;
      category: VoucherCategory;
      face_value: number | null;
      used_value: number;
      paid_value: number | null;
      currency: string;
      purchase_date: string | null;
      expiry_date: string;
      notes: string | null;
      source_type: 'manual';
      metadata: Record<string, never>;
      updated_at: string;
      code?: string | null;
    } = {
      voucher_type: input.voucherType,
      title: input.title,
      product_name: input.productName,
      merchant_name: input.merchantName,
      category: input.category,
      face_value: input.faceValue,
      used_value: input.usedValue,
      paid_value: input.paidValue,
      currency: input.currency,
      purchase_date: input.purchaseDate,
      expiry_date: input.expiryDate,
      notes: input.notes,
      source_type: 'manual',
      metadata: {},
      updated_at: new Date().toISOString(),
    };

    if (shouldUpdateCode) {
      updatePayload.code = input.code;
    }

    const { data, error } = await client
      .from('vouchers')
      .update(updatePayload)
      .eq('wallet_id', input.walletId)
      .eq('id', input.voucherId)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return upsertFallbackVoucher(input);
      }

      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Voucher not found.');
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
      .eq('id', voucherId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const [voucher] = await hydrateAttachments([mapVoucher(data)]);
    return voucher;
  },

  async updateMonetaryUsage(walletId: string, voucherId: string, usedValue: number): Promise<Voucher> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      const voucher = readFallbackVouchers(walletId).find((item) => item.id === voucherId);

      if (!voucher) {
        throw new Error('Voucher not found.');
      }

      if (voucher.voucherType !== 'monetary' || voucher.faceValue === null) {
        throw new Error('Usage updates are supported only for monetary vouchers.');
      }

      const clampedUsedValue = Math.max(0, Math.min(usedValue, voucher.faceValue));
      const isRedeemed = clampedUsedValue >= voucher.faceValue;
      const now = new Date().toISOString();

      const updated: Voucher = {
        ...voucher,
        usedValue: clampedUsedValue,
        remainingValue: Math.max(voucher.faceValue - clampedUsedValue, 0),
        status: isRedeemed ? 'redeemed' : 'active',
        redeemedAt: isRedeemed ? now : null,
        updatedAt: now,
      };

      const next = readFallbackVouchers(walletId).filter((item) => item.id !== voucherId);
      writeFallbackVouchers(walletId, [...next, updated]);

      return updated;
    }

    const { data: current, error: readError } = await client
      .from('vouchers')
      .select('*')
      .eq('id', voucherId)
      .single();

    if (readError) {
      throw new Error(readError.message);
    }

    const voucher = mapVoucher(current);

    if (voucher.voucherType !== 'monetary' || voucher.faceValue === null) {
      throw new Error('Usage updates are supported only for monetary vouchers.');
    }

    const clampedUsedValue = Math.max(0, Math.min(usedValue, voucher.faceValue));
    const isRedeemed = clampedUsedValue >= voucher.faceValue;

    const { data, error } = await client
      .from('vouchers')
      .update({
        used_value: clampedUsedValue,
        status: isRedeemed ? 'redeemed' : 'active',
        redeemed_at: isRedeemed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voucherId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const [updatedVoucher] = await hydrateAttachments([mapVoucher(data)]);
    return updatedVoucher;
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
