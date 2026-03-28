import { maybeGetSupabaseClient } from '../lib/supabase';
import { env } from '../lib/env';
import type { VoucherDraftExtractionResult } from '../types/domain';

type ExtractVoucherDraftPayload = {
  walletId: string;
  fileName: string;
  mimeType: string;
  fileBase64?: string;
  storageBucket?: string;
  storagePath?: string;
};

type ExtractVoucherDraftResponse = {
  suggestion: VoucherDraftExtractionResult['suggestion'];
  metadata?: {
    method?: VoucherDraftExtractionResult['method'];
    warnings?: string[];
  };
};

function isLikelyJwt(token: string): boolean {
  return token.split('.').length === 3;
}

function pickErrorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.message, record.error, record.code];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

async function buildFunctionErrorMessage(error: unknown): Promise<string> {
  return error instanceof Error && error.message ? error.message : 'Voucher extraction failed.';
}

function shouldRetryWithRefreshedSession(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return message.includes('http 401') || message.includes('invalid jwt') || message.includes('unauthorized');
}

async function invokeExtractFunction(input: {
  accessToken: string;
  payload: ExtractVoucherDraftPayload;
}): Promise<ExtractVoucherDraftResponse> {
  const response = await fetch(`${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/extract-voucher-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify(input.payload),
  });

  const rawBody = await response.text();
  const parsedBody = (() => {
    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody) as unknown;
    } catch (_parseError) {
      return rawBody;
    }
  })();

  if (!response.ok) {
    const detail =
      pickErrorDetail(parsedBody) ??
      (typeof parsedBody === 'string' ? parsedBody : null) ??
      'Voucher extraction failed.';
    const statusLabel = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    throw new Error(`${detail} (${statusLabel})`);
  }

  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return { suggestion: {} as VoucherDraftExtractionResult['suggestion'] };
  }

  return parsedBody as ExtractVoucherDraftResponse;
}

export const voucherExtractionRepository = {
  async uploadIntakeObject(input: {
    bucket: string;
    path: string;
    contentType: string;
    payload: Blob;
  }): Promise<void> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      throw new Error('Supabase environment variables are missing. Copy .env.example to .env and fill in the Expo public Supabase values.');
    }

    const { error } = await client.storage.from(input.bucket).upload(input.path, input.payload, {
      contentType: input.contentType,
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async removeIntakeObject(input: { bucket: string; path: string }): Promise<void> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      return;
    }

    const { error } = await client.storage.from(input.bucket).remove([input.path]);

    if (error) {
      console.warn('[voucherExtractionRepository] removeIntakeObject failed:', error.message);
    }
  },

  async extractDraft(payload: ExtractVoucherDraftPayload): Promise<VoucherDraftExtractionResult> {
    const client = maybeGetSupabaseClient();

    if (!client) {
      throw new Error('Supabase environment variables are missing. Copy .env.example to .env and fill in the Expo public Supabase values.');
    }
    const supabase = client;

    async function resolveAccessToken(): Promise<string> {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token && isLikelyJwt(session.access_token)) {
        return session.access_token;
      }

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshed.session?.access_token || !isLikelyJwt(refreshed.session.access_token)) {
        throw new Error('Session is invalid or expired. Please sign out and sign in again.');
      }

      return refreshed.session.access_token;
    }

    let accessToken = await resolveAccessToken();
    let data: ExtractVoucherDraftResponse | null = null;
    let error: unknown = null;

    try {
      data = await invokeExtractFunction({
        accessToken,
        payload,
      });
    } catch (invokeError) {
      error = invokeError;
    }

    if (error && shouldRetryWithRefreshedSession(error)) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshed.session?.access_token || !isLikelyJwt(refreshed.session.access_token)) {
        const message = await buildFunctionErrorMessage(error);
        throw new Error(message);
      }

      accessToken = refreshed.session.access_token;

      try {
        data = await invokeExtractFunction({
          accessToken,
          payload,
        });
        error = null;
      } catch (retryInvokeError) {
        error = retryInvokeError;
      }
    }

    if (error) {
      const message = await buildFunctionErrorMessage(error);
      throw new Error(message);
    }

    const typed = (data ?? {}) as ExtractVoucherDraftResponse;

    return {
      suggestion: typed.suggestion ?? {
        voucherType: null,
        category: null,
        merchantName: null,
        productName: null,
        faceValue: null,
        usedValue: null,
        expiryDate: null,
        code: null,
        notes: null,
        confidence: null,
        metadata: {},
      },
      method: typed.metadata?.method === 'openai' ? 'openai' : 'heuristic',
      warnings: typed.metadata?.warnings ?? [],
    };
  },
};
