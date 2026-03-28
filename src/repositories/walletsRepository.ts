import type { Wallet, WalletMember } from '../types/domain';
import { maybeGetSupabaseClient } from '../lib/supabase';
import { isMissingRelationError } from '../utils/supabase';

function mapWallet(row: {
  id: string;
  owner_user_id: string;
  name: string;
  type: 'personal' | 'family' | 'shared';
  default_currency: string;
  created_at: string;
  updated_at: string;
}): Wallet {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    type: row.type,
    defaultCurrency: row.default_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWalletMember(row: {
  id: string;
  wallet_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'revoked';
  created_at: string;
}): WalletMember {
  return {
    id: row.id,
    walletId: row.wallet_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

function buildFallbackWallet(userId: string): Wallet {
  const now = new Date().toISOString();

  return {
    id: `personal-${userId}`,
    ownerUserId: userId,
    name: 'My Wallet',
    type: 'personal',
    defaultCurrency: 'ILS',
    createdAt: now,
    updatedAt: now,
  };
}

export const walletsRepository = {
  async getPersonalWallet(userId: string): Promise<Wallet> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return buildFallbackWallet(userId);
    }

    const { data, error } = await client
      .from('wallets')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('type', 'personal')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return buildFallbackWallet(userId);
      }

      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Personal wallet was not provisioned for this account yet. Please sign out and sign in again, or contact support if it persists.');
    }

    return mapWallet(data);
  },

  async listWalletsForUser(userId: string): Promise<Wallet[]> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return [buildFallbackWallet(userId)];
    }

    // TODO: expand to wallet_members-based discovery when family/shared wallet selection is enabled in the UI.
    const { data, error } = await client.from('wallets').select('*').eq('owner_user_id', userId).order('created_at');

    if (error) {
      if (isMissingRelationError(error)) {
        return [buildFallbackWallet(userId)];
      }

      throw new Error(error.message);
    }

    if (!data.length) {
      return [buildFallbackWallet(userId)];
    }

    return data.map(mapWallet);
  },

  async listMembers(walletId: string): Promise<WalletMember[]> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return [];
    }

    // TODO: when richer role-based permissions are needed, add a permissions jsonb column here
    //       rather than widening the role enum.
    const { data, error } = await client.from('wallet_members').select('*').eq('wallet_id', walletId).order('created_at');

    if (error) {
      if (isMissingRelationError(error)) {
        return [];
      }

      throw new Error(error.message);
    }

    return data.map(mapWalletMember);
  },
};