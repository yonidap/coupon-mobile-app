import { walletsRepository } from '../repositories/walletsRepository';

export const walletsService = {
  async getActiveWallet(userId: string) {
    // TODO: route this through a wallet selector once family/shared wallet UX is added.
    return walletsRepository.getPersonalWallet(userId);
  },

  async listWallets(userId: string) {
    return walletsRepository.listWalletsForUser(userId);
  },

  async listMembers(walletId: string) {
    return walletsRepository.listMembers(walletId);
  },
};