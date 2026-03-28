import type { VoucherCategory } from '../features/vouchers/categories';
import type { SupportedLanguage } from '../features/settings/language';

export type CurrencyCode = string;
export type ISODateString = string;

// --- Wallet ---
export type WalletType = 'personal' | 'family' | 'shared';
export type WalletRole = 'owner' | 'admin' | 'member' | 'viewer';
export type WalletMemberStatus = 'active' | 'invited' | 'revoked';

// --- Voucher ---
// 'redeemed' matches the SQL check constraint (not 'used').
export type VoucherStatus = 'active' | 'redeemed' | 'expired' | 'archived';
export type VoucherType = 'monetary' | 'product';
export type VoucherSource =
  | 'manual'
  | 'upload'
  | 'email_import'
  | 'ocr_import'
  | 'shared'
  | 'barcode_scan'
  | 'api';

// --- Attachment ---
// 'kind' values match the SQL voucher_attachments.kind check constraint.
export type AttachmentKind = 'original' | 'preview' | 'ocr_source' | 'ocr_output';

// --- Processing jobs ---
export type ProcessingJobType = 'ocr' | 'email_parse' | 'thumbnail' | 'barcode_extract';
export type ProcessingJobStatus = 'pending' | 'running' | 'completed' | 'failed';

// --- Invite ---
export type WalletInviteStatus = 'pending' | 'accepted' | 'revoked';

// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  displayName: string | null;
  defaultCurrency: CurrencyCode;
  language: SupportedLanguage;
  timezone: string;
  notificationsEnabled: boolean;
  defaultReminderOffsets: number[];
  createdAt: string;
  updatedAt: string;
}

export interface Wallet {
  id: string;
  ownerUserId: string;
  name: string;
  type: WalletType;
  defaultCurrency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface WalletMember {
  id: string;
  walletId: string;
  userId: string;
  role: WalletRole;
  status: WalletMemberStatus;
  createdAt: string;
}

export interface WalletInvite {
  id: string;
  walletId: string;
  email: string;
  invitedByUserId: string;
  status: WalletInviteStatus;
  createdAt: string;
}

export interface VoucherAttachment {
  id: string;
  voucherId: string;
  kind: AttachmentKind;
  storageBucket: string;
  storagePath: string;
  fileName: string | null;
  mimeType: string;
  fileSizeBytes: number | null;
  uploadedByUserId: string;
  createdAt: string;
}

export interface VoucherReminder {
  id: string;
  voucherId: string;
  offsetDays: number;
  channel: 'push' | 'email';
  sentAt: string | null;
  createdAt: string;
}

export interface Voucher {
  id: string;
  walletId: string;
  createdByUserId: string;
  voucherType: VoucherType;
  title: string;
  productName: string | null;
  merchantName: string | null;
  category: VoucherCategory | null;
  faceValue: number | null;
  usedValue: number;
  remainingValue: number | null;
  paidValue: number | null;
  currency: CurrencyCode;
  purchaseDate: ISODateString | null;
  expiryDate: ISODateString;
  code: string | null;
  notes: string | null;
  status: VoucherStatus;
  source: VoucherSource;
  metadata: Record<string, unknown>;
  redeemedAt: string | null;
  attachments: VoucherAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PickedAttachment {
  localUri: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface VoucherDraftSuggestion {
  voucherType: VoucherType | null;
  category: VoucherCategory | null;
  merchantName: string | null;
  productName: string | null;
  faceValue: number | null;
  usedValue: number | null;
  expiryDate: ISODateString | null;
  code: string | null;
  notes: string | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
}

export interface VoucherDraftExtractionResult {
  suggestion: VoucherDraftSuggestion;
  method: 'openai' | 'heuristic';
  warnings: string[];
}

export interface ProcessingJob {
  id: string;
  entityType: 'voucher' | 'attachment' | 'wallet';
  entityId: string;
  jobType: ProcessingJobType;
  status: ProcessingJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRegistrationResult {
  status: 'registered' | 'denied' | 'unavailable';
  token?: string;
  message?: string;
}
