import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { VoucherFormValues } from '../features/vouchers/schemas';
import { voucherService } from '../services/voucherService';

const voucherKeys = {
  all: ['vouchers'] as const,
  list: (userId: string) => [...voucherKeys.all, 'list', userId] as const,
  detail: (userId: string, voucherId: string) => [...voucherKeys.all, 'detail', userId, voucherId] as const,
};

export function useVoucherList(userId?: string) {
  return useQuery({
    queryKey: userId ? voucherKeys.list(userId) : voucherKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => voucherService.listForUser(userId as string),
  });
}

export function useVoucherDetails(userId?: string, voucherId?: string) {
  return useQuery({
    queryKey: userId && voucherId ? voucherKeys.detail(userId, voucherId) : voucherKeys.all,
    enabled: Boolean(userId && voucherId),
    queryFn: async () => voucherService.getVoucher(userId as string, voucherId as string),
  });
}

export function useSaveVoucherMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ voucherId, values }: { voucherId?: string; values: VoucherFormValues }) => {
      if (!userId) {
        throw new Error('You must be signed in to save a voucher.');
      }

      return voucherService.saveVoucher({
        userId,
        voucherId,
        values,
      });
    },
    onSuccess: async (voucher) => {
      if (!userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: voucherKeys.list(userId) });
      await queryClient.invalidateQueries({ queryKey: voucherKeys.detail(userId, voucher.id) });
    },
  });
}

export function useDeleteVoucherMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ voucherId }: { voucherId: string }) => {
      if (!userId) {
        throw new Error('You must be signed in to delete a voucher.');
      }

      await voucherService.deleteVoucher(userId, voucherId);
      return voucherId;
    },
    onSuccess: async (voucherId) => {
      if (!userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: voucherKeys.list(userId) });
      queryClient.removeQueries({ queryKey: voucherKeys.detail(userId, voucherId) });
    },
  });
}

export function useMarkVoucherRedeemedMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ voucherId }: { voucherId: string }) => {
      if (!userId) {
        throw new Error('You must be signed in to update a voucher.');
      }

      return voucherService.markVoucherRedeemed(userId, voucherId);
    },
    onSuccess: async (voucher) => {
      if (!userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: voucherKeys.list(userId) });
      await queryClient.invalidateQueries({ queryKey: voucherKeys.detail(userId, voucher.id) });
    },
  });
}