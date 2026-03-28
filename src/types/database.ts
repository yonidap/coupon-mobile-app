import type { VoucherCategory } from '../features/vouchers/categories';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------------------
// Auto-aligned with supabase/migrations/20260326000001_initial_schema.sql
// Re-generate or update here when the schema changes.
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          default_currency: string;
          language: string;
          timezone: string;
          notifications_enabled: boolean;
          default_reminder_offsets: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          default_currency?: string;
          language?: string;
          timezone?: string;
          notifications_enabled?: boolean;
          default_reminder_offsets?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          default_currency?: string;
          language?: string;
          timezone?: string;
          notifications_enabled?: boolean;
          default_reminder_offsets?: number[];
          updated_at?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          name: string;
          type: 'personal' | 'family' | 'shared';
          owner_user_id: string;
          default_currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: 'personal' | 'family' | 'shared';
          owner_user_id: string;
          default_currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          type?: 'personal' | 'family' | 'shared';
          default_currency?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallet_members: {
        Row: {
          id: string;
          wallet_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member' | 'viewer';
          status: 'active' | 'invited' | 'revoked';
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'member' | 'viewer';
          status?: 'active' | 'invited' | 'revoked';
          created_at?: string;
        };
        Update: {
          role?: 'owner' | 'admin' | 'member' | 'viewer';
          status?: 'active' | 'invited' | 'revoked';
        };
        Relationships: [];
      };
      vouchers: {
        Row: {
          id: string;
          wallet_id: string;
          created_by_user_id: string;
          voucher_type: 'monetary' | 'product';
          title: string;
          product_name: string | null;
          merchant_name: string | null;
          category: VoucherCategory | null;
          face_value: number | null;
          used_value: number;
          paid_value: number | null;
          currency: string;
          purchase_date: string | null;
          expiry_date: string;
          code: string | null;
          notes: string | null;
          status: 'active' | 'redeemed' | 'expired' | 'archived';
          source_type: 'manual' | 'upload' | 'email_import' | 'ocr_import' | 'shared' | 'barcode_scan' | 'api';
          metadata: Json;
          redeemed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          created_by_user_id: string;
          voucher_type?: 'monetary' | 'product';
          title: string;
          product_name?: string | null;
          merchant_name?: string | null;
          category?: VoucherCategory | null;
          face_value?: number | null;
          used_value?: number;
          paid_value?: number | null;
          currency: string;
          purchase_date?: string | null;
          expiry_date: string;
          code?: string | null;
          notes?: string | null;
          status?: 'active' | 'redeemed' | 'expired' | 'archived';
          source_type?: 'manual' | 'upload' | 'email_import' | 'ocr_import' | 'shared' | 'barcode_scan' | 'api';
          metadata?: Json;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          voucher_type?: 'monetary' | 'product';
          product_name?: string | null;
          merchant_name?: string | null;
          category?: VoucherCategory | null;
          face_value?: number | null;
          used_value?: number;
          paid_value?: number | null;
          currency?: string;
          purchase_date?: string | null;
          expiry_date?: string;
          code?: string | null;
          notes?: string | null;
          status?: 'active' | 'redeemed' | 'expired' | 'archived';
          source_type?: 'manual' | 'upload' | 'email_import' | 'ocr_import' | 'shared' | 'barcode_scan' | 'api';
          metadata?: Json;
          redeemed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      voucher_attachments: {
        Row: {
          id: string;
          voucher_id: string;
          storage_bucket: string;
          storage_path: string;
          file_name: string | null;
          mime_type: string;
          file_size_bytes: number | null;
          uploaded_by_user_id: string;
          kind: 'original' | 'preview' | 'ocr_source' | 'ocr_output';
          created_at: string;
        };
        Insert: {
          id?: string;
          voucher_id: string;
          storage_bucket: string;
          storage_path: string;
          file_name?: string | null;
          mime_type: string;
          file_size_bytes?: number | null;
          uploaded_by_user_id: string;
          kind?: 'original' | 'preview' | 'ocr_source' | 'ocr_output';
          created_at?: string;
        };
        Update: {
          file_name?: string | null;
          mime_type?: string;
          file_size_bytes?: number | null;
          kind?: 'original' | 'preview' | 'ocr_source' | 'ocr_output';
        };
        Relationships: [];
      };
      voucher_reminders: {
        Row: {
          id: string;
          voucher_id: string;
          offset_days: number;
          channel: 'push' | 'email';
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          voucher_id: string;
          offset_days: number;
          channel?: 'push' | 'email';
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          offset_days?: number;
          channel?: 'push' | 'email';
          sent_at?: string | null;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          device_platform: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expo_push_token: string;
          device_platform?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          expo_push_token?: string;
          device_platform?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallet_invites: {
        Row: {
          id: string;
          wallet_id: string;
          email: string;
          invited_by_user_id: string;
          status: 'pending' | 'accepted' | 'revoked';
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          email: string;
          invited_by_user_id: string;
          status?: 'pending' | 'accepted' | 'revoked';
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'revoked';
        };
        Relationships: [];
      };
      processing_jobs: {
        // Service-role only. No RLS policies for authenticated clients.
        Row: {
          id: string;
          entity_type: 'voucher' | 'attachment' | 'wallet';
          entity_id: string;
          job_type: 'ocr' | 'email_parse' | 'thumbnail' | 'barcode_extract';
          status: 'pending' | 'running' | 'completed' | 'failed';
          payload: Json;
          result: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_type: 'voucher' | 'attachment' | 'wallet';
          entity_id: string;
          job_type: 'ocr' | 'email_parse' | 'thumbnail' | 'barcode_extract';
          status?: 'pending' | 'running' | 'completed' | 'failed';
          payload?: Json;
          result?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'running' | 'completed' | 'failed';
          payload?: Json;
          result?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_events: {
        // Service-role only. No RLS policies for authenticated clients.
        Row: {
          id: string;
          actor_user_id: string | null;
          wallet_id: string | null;
          entity_type: string;
          entity_id: string | null;
          action: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          wallet_id?: string | null;
          entity_type: string;
          entity_id?: string | null;
          action: string;
          payload?: Json;
          created_at?: string;
        };
        Update: Record<string, never>; // append-only
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
