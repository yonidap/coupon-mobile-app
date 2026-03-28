import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

type VoucherType = 'monetary' | 'product';
type VoucherCategory =
  | 'Groceries'
  | 'Dining'
  | 'Shopping'
  | 'Travel'
  | 'Entertainment'
  | 'Health & Beauty'
  | 'Electronics'
  | 'Home & Garden'
  | 'Other';

const VOUCHER_CATEGORIES: readonly VoucherCategory[] = [
  'Groceries',
  'Dining',
  'Shopping',
  'Travel',
  'Entertainment',
  'Health & Beauty',
  'Electronics',
  'Home & Garden',
  'Other',
];

type Suggestion = {
  voucherType: VoucherType | null;
  category: VoucherCategory | null;
  merchantName: string | null;
  productName: string | null;
  faceValue: number | null;
  usedValue: number | null;
  expiryDate: string | null;
  code: string | null;
  notes: string | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
};

type ExtractRequestBody = {
  walletId?: string;
  storageBucket?: string;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  fileBase64?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const emptySuggestion: Suggestion = {
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
};

const MAX_OPENAI_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_PDF_IMAGE_BYTES = 600_000;
const MAX_INLINE_IMAGE_DATA_URL_CHARS = 900_000;
const OPENAI_FETCH_TIMEOUT_MS = 20_000;
const ENABLE_PDF_FLATE_IMAGE_EXTRACTION = false;
const MAX_PDF_IMAGE_PIXELS = 2_000_000;
const MAX_PDF_BYTES_FOR_IMAGE_EXTRACTION = 400_000;
const OPENAI_SUGGESTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    voucherType: {
      anyOf: [{ type: 'string', enum: ['monetary', 'product'] }, { type: 'null' }],
    },
    category: {
      anyOf: [{ type: 'string', enum: [...VOUCHER_CATEGORIES] }, { type: 'null' }],
    },
    merchantName: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    productName: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    faceValue: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
    },
    usedValue: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
    },
    expiryDate: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    code: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    notes: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    confidence: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['voucherType', 'category', 'merchantName', 'productName', 'faceValue', 'usedValue', 'expiryDate', 'code', 'notes', 'confidence', 'metadata'],
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function sanitizeText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, maxLength) : null;
}

function sanitizeCode(value: unknown): string | null {
  const text = sanitizeText(value, 64);

  if (!text) {
    return null;
  }

  return text.replace(/\s+/g, '').toUpperCase();
}

function isCodeLikeToken(value: string): boolean {
  const compact = value.replace(/[\s-]/g, '');

  if (compact.length < 6) {
    return false;
  }

  if (!/^[A-Z0-9]+$/i.test(compact)) {
    return false;
  }

  const digits = (compact.match(/\d/g) ?? []).length;
  const letters = (compact.match(/[A-Z]/gi) ?? []).length;

  // Typical voucher-code shape: many digits, optional prefix letter(s), little punctuation.
  if (digits >= 6) {
    return true;
  }

  return digits >= 4 && letters >= 1 && digits >= letters;
}

function sanitizeMerchantName(value: unknown): string | null {
  const text = sanitizeText(value, 120);

  if (!text) {
    return null;
  }

  // Reject machine-looking values that are likely codes.
  if (isCodeLikeToken(text)) {
    return null;
  }

  if (!/[a-zA-Z\u0590-\u05FF]/.test(text)) {
    return null;
  }

  return text;
}

function sanitizeProductName(value: unknown): string | null {
  const text = sanitizeText(value, 160);

  if (!text) {
    return null;
  }

  if (isCodeLikeToken(text)) {
    return null;
  }

  if (!/[a-zA-Z\u0590-\u05FF]/.test(text)) {
    return null;
  }

  return text;
}

function sanitizeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }

    return Number(value.toFixed(2));
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(',', '.');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  const sameYear = candidate.getUTCFullYear() === year;
  const sameMonth = candidate.getUTCMonth() === month - 1;
  const sameDay = candidate.getUTCDate() === day;

  if (!sameYear || !sameMonth || !sameDay) {
    return null;
  }

  const monthLabel = String(month).padStart(2, '0');
  const dayLabel = String(day).padStart(2, '0');
  return `${year}-${monthLabel}-${dayLabel}`;
}

function normalizeDate(value: unknown): string | null {
  const text = sanitizeText(value, 32);

  if (!text) {
    return null;
  }

  const ymd = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);

  if (ymd) {
    return toIsoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);

  if (dmy) {
    const year = Number(dmy[3]);
    const normalizedYear = year < 100 ? year + 2000 : year;
    return toIsoDate(normalizedYear, Number(dmy[2]), Number(dmy[1]));
  }

  return null;
}

function normalizeVoucherType(value: unknown): VoucherType | null {
  if (value === 'monetary' || value === 'product') {
    return value;
  }

  return null;
}

function normalizeCategory(value: unknown): VoucherCategory | null {
  const text = sanitizeText(value, 64);

  if (!text) {
    return null;
  }

  if ((VOUCHER_CATEGORIES as readonly string[]).includes(text)) {
    return text as VoucherCategory;
  }

  const normalized = text.toLowerCase();
  const keywordMap: Array<{ category: VoucherCategory; keywords: string[] }> = [
    { category: 'Groceries', keywords: ['grocery', 'groceries', 'supermarket', 'market', 'מכולת', 'סופר'] },
    { category: 'Dining', keywords: ['dining', 'restaurant', 'cafe', 'coffee', 'food', 'מסעד', 'קפה'] },
    { category: 'Shopping', keywords: ['shopping', 'shop', 'store', 'fashion', 'mall', 'קניות', 'חנות'] },
    { category: 'Travel', keywords: ['travel', 'flight', 'hotel', 'airline', 'vacation', 'נסיע', 'טיסה', 'מלון'] },
    { category: 'Entertainment', keywords: ['entertainment', 'cinema', 'movie', 'concert', 'game', 'בילוי', 'סרט'] },
    { category: 'Health & Beauty', keywords: ['health', 'beauty', 'spa', 'massage', 'wellness', 'בריאות', 'יופי', 'ספא', 'עיסוי'] },
    { category: 'Electronics', keywords: ['electronics', 'electric', 'phone', 'laptop', 'computer', 'אלקטרונ', 'חשמל', 'מחשב'] },
    { category: 'Home & Garden', keywords: ['home', 'garden', 'furniture', 'kitchen', 'house', 'בית', 'גן', 'ריהוט', 'מטבח'] },
    { category: 'Other', keywords: ['other', 'misc', 'general', 'אחר'] },
  ];

  for (const { category, keywords } of keywordMap) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return null;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return Number(value.toFixed(2));
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function resolveConfiguredModel(rawValue: string | undefined, fallback: string): string {
  const value = (rawValue ?? '').trim();

  if (!value) {
    return fallback;
  }

  // Mini models are often weaker for OCR-heavy voucher parsing in this MVP.
  if (value.toLowerCase().includes('mini')) {
    return fallback;
  }

  return value;
}

function normalizeSuggestion(value: unknown): Suggestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...emptySuggestion };
  }

  const raw = value as Record<string, unknown>;

  return {
    voucherType: normalizeVoucherType(raw.voucherType),
    category: normalizeCategory(raw.category),
    merchantName: sanitizeMerchantName(raw.merchantName),
    productName: sanitizeProductName(raw.productName),
    faceValue: sanitizeNumber(raw.faceValue),
    usedValue: sanitizeNumber(raw.usedValue),
    expiryDate: normalizeDate(raw.expiryDate),
    code: sanitizeCode(raw.code),
    notes: sanitizeText(raw.notes, 1200),
    confidence: normalizeConfidence(raw.confidence),
    metadata: normalizeMetadata(raw.metadata),
  };
}

function mergeSuggestions(primary: Suggestion, fallback: Suggestion): Suggestion {
  return {
    voucherType: primary.voucherType ?? fallback.voucherType,
    category: primary.category ?? fallback.category,
    merchantName: primary.merchantName ?? fallback.merchantName,
    productName: primary.productName ?? fallback.productName,
    faceValue: primary.faceValue ?? fallback.faceValue,
    usedValue: primary.usedValue ?? fallback.usedValue,
    expiryDate: primary.expiryDate ?? fallback.expiryDate,
    code: primary.code ?? fallback.code,
    notes: primary.notes ?? fallback.notes,
    confidence: primary.confidence ?? fallback.confidence,
    metadata: {
      ...fallback.metadata,
      ...primary.metadata,
    },
  };
}

function countSuggestedFields(suggestion: Suggestion): number {
  const fields = [
    suggestion.voucherType,
    suggestion.category,
    suggestion.merchantName,
    suggestion.productName,
    suggestion.faceValue,
    suggestion.usedValue,
    suggestion.expiryDate,
    suggestion.code,
    suggestion.notes,
  ];

  let count = 0;

  for (const value of fields) {
    if (value !== null) {
      count += 1;
    }
  }

  return count;
}

function countCoreFields(suggestion: Suggestion): number {
  const fields = [
    suggestion.voucherType,
    suggestion.merchantName,
    suggestion.productName,
    suggestion.faceValue,
    suggestion.expiryDate,
  ];

  let count = 0;

  for (const value of fields) {
    if (value !== null) {
      count += 1;
    }
  }

  return count;
}

function isWeakExtraction(suggestion: Suggestion | null): boolean {
  if (!suggestion) {
    return true;
  }

  // "Only code" is treated as weak; users still need merchant/product/expiry/value.
  if (countCoreFields(suggestion) === 0 && suggestion.code !== null) {
    return true;
  }

  return countCoreFields(suggestion) < 2;
}

function removeFileExtension(fileName: string): string {
  return fileName.replace(/\.[a-zA-Z0-9]+$/, '');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractMerchantFromFileName(fileName: string): string | null {
  const stopWords = new Set(['gift', 'card', 'coupon', 'voucher', 'image', 'scan', 'receipt', 'invoice', 'pdf', 'jpg', 'jpeg', 'png']);
  const base = removeFileExtension(fileName).replace(/[_-]+/g, ' ');
  const words = base
    .split(/\s+/)
    .filter((word) => /[a-zA-Z\u0590-\u05FF]/.test(word))
    .filter((word) => !/[0-9]/.test(word))
    .filter((word) => !stopWords.has(word.toLowerCase()));

  if (!words.length) {
    return null;
  }

  return titleCase(words.slice(0, 3).join(' '));
}

type DateCandidate = {
  date: string;
  index: number;
};

function collectDateCandidates(input: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const ymdPattern = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
  const dmyPattern = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g;

  for (const match of input.matchAll(ymdPattern)) {
    const parsed = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

    if (parsed) {
      candidates.push({
        date: parsed,
        index: match.index ?? 0,
      });
    }
  }

  for (const match of input.matchAll(dmyPattern)) {
    const rawYear = Number(match[3]);
    const year = rawYear < 100 ? rawYear + 2000 : rawYear;
    const parsed = toIsoDate(year, Number(match[2]), Number(match[1]));

    if (parsed) {
      candidates.push({
        date: parsed,
        index: match.index ?? 0,
      });
    }
  }

  return candidates;
}

function pickBestExpiryCandidate(input: string, candidates: DateCandidate[]): string | null {
  if (!candidates.length) {
    return null;
  }

  const expiryKeywords = [
    'expiry',
    'expires',
    'valid until',
    'use by',
    'exp date',
    'exp.',
    'תוקף',
    'בתוקף',
    'פג תוקף',
    'תאריך תפוגה',
    'עד ליום',
  ];
  const nonExpiryKeywords = ['purchase', 'purchased', 'invoice', 'issued', 'receipt', 'קניה', 'רכישה', 'חשבונית', 'הונפק'];
  const nowIso = new Date().toISOString().slice(0, 10);
  let best: { date: string; score: number } | null = null;

  for (const candidate of candidates) {
    const start = Math.max(0, candidate.index - 40);
    const end = Math.min(input.length, candidate.index + 40);
    const context = input.slice(start, end).toLowerCase();
    let score = 1;

    if (expiryKeywords.some((keyword) => context.includes(keyword))) {
      score += 8;
    }

    if (nonExpiryKeywords.some((keyword) => context.includes(keyword))) {
      score -= 4;
    }

    if (candidate.date >= nowIso) {
      score += 2;
    }

    if (!best || score > best.score || (score === best.score && candidate.date > best.date)) {
      best = {
        date: candidate.date,
        score,
      };
    }
  }

  return best?.date ?? null;
}

function extractDateFromText(input: string): string | null {
  const candidates = collectDateCandidates(input);
  return pickBestExpiryCandidate(input, candidates);
}

function extractAmountFromText(input: string): number | null {
  const currencyDriven =
    input.match(/(?:₪|nis|ils|usd|\$|eur|€)\s*([0-9]{1,5}(?:[.,][0-9]{1,2})?)/i) ??
    input.match(/(?:value|amount|balance)\s*[:\-]?\s*([0-9]{1,5}(?:[.,][0-9]{1,2})?)/i);

  if (!currencyDriven) {
    return null;
  }

  return sanitizeNumber(currencyDriven[1]);
}

function normalizeSpacing(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractLabeledValue(input: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n\\r|]{2,80})`, 'i');
    const match = input.match(pattern);

    if (!match) {
      continue;
    }

    const value = normalizeSpacing(match[1] ?? '');

    if (value && !isCodeLikeToken(value)) {
      return value;
    }
  }

  return null;
}

function extractNameCandidates(input: string): string[] {
  const stopWords = new Set([
    'gift',
    'voucher',
    'coupon',
    'code',
    'pin',
    'תוקף',
    'קוד',
    'שובר',
    'שוברים',
    'תאריך',
    'כרטיס',
    'הטבה',
    'מימוש',
    'balance',
    'value',
    'amount',
  ]);
  const matches = input.match(/[A-Za-z\u0590-\u05FF][A-Za-z\u0590-\u05FF '&".-]{1,70}/g) ?? [];
  const unique = new Set<string>();

  for (const raw of matches) {
    const candidate = normalizeSpacing(raw);

    if (candidate.length < 2 || candidate.length > 50) {
      continue;
    }

    if (isCodeLikeToken(candidate)) {
      continue;
    }

    const words = candidate.split(' ').filter(Boolean);

    if (words.length > 5) {
      continue;
    }

    if (words.every((word) => stopWords.has(word.toLowerCase()))) {
      continue;
    }

    unique.add(candidate);
  }

  return [...unique];
}

function extractMerchantNameFromText(input: string): string | null {
  const fromLabel = extractLabeledValue(input, ['merchant', 'store', 'brand', 'business', 'בית עסק', 'סוחר', 'רשת', 'מותג']);

  if (fromLabel) {
    return sanitizeMerchantName(fromLabel);
  }

  const candidates = extractNameCandidates(input);

  for (const candidate of candidates) {
    const sanitized = sanitizeMerchantName(candidate);

    if (sanitized) {
      return sanitized;
    }
  }

  return null;
}

function extractProductNameFromText(input: string): string | null {
  const fromLabel = extractLabeledValue(input, ['product', 'service', 'package', 'title', 'מוצר', 'שירות', 'שם מוצר', 'פריט']);

  if (fromLabel) {
    return sanitizeProductName(fromLabel);
  }

  const candidates = extractNameCandidates(input);

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();

    if (lower.includes('gift') || lower.includes('voucher') || lower.includes('שובר')) {
      continue;
    }

    const sanitized = sanitizeProductName(candidate);

    if (sanitized) {
      return sanitized;
    }
  }

  return null;
}

function extractCodeFromText(input: string): string | null {
  const keywordMatch = input.match(/(?:code|pin|voucher)\s*[:#-]?\s*([a-zA-Z0-9-]{4,24})/i);

  if (keywordMatch) {
    return sanitizeCode(keywordMatch[1]);
  }

  const genericMatch = input.match(/\b([A-Z0-9]{6,16})\b/);

  if (!genericMatch) {
    return null;
  }

  const candidate = genericMatch[1];

  if (!/[A-Z]/.test(candidate) || !/[0-9]/.test(candidate)) {
    return null;
  }

  return sanitizeCode(candidate);
}

function inferVoucherType(input: string): VoucherType | null {
  const normalized = input.toLowerCase();
  const monetaryKeywords = ['gift card', 'balance', 'amount', 'value', 'nis', 'ils', 'usd', '$', '₪'];
  const productKeywords = ['ticket', 'spa', 'massage', 'meal', 'package', 'service', 'product', 'class', 'entry'];

  const hasMonetary = monetaryKeywords.some((keyword) => normalized.includes(keyword));
  const hasProduct = productKeywords.some((keyword) => normalized.includes(keyword));

  if (hasMonetary && !hasProduct) {
    return 'monetary';
  }

  if (hasProduct && !hasMonetary) {
    return 'product';
  }

  return null;
}

function inferCategoryFromText(input: string): VoucherCategory | null {
  const normalized = input.toLowerCase();
  const buckets: Array<{ category: VoucherCategory; keywords: string[] }> = [
    { category: 'Groceries', keywords: ['grocery', 'groceries', 'supermarket', 'market', 'מכולת', 'סופר'] },
    { category: 'Dining', keywords: ['restaurant', 'dining', 'cafe', 'coffee', 'food', 'מסעד', 'קפה'] },
    { category: 'Shopping', keywords: ['shopping', 'shop', 'store', 'retail', 'קניות', 'חנות'] },
    { category: 'Travel', keywords: ['travel', 'flight', 'hotel', 'airline', 'vacation', 'נסיע', 'טיסה', 'מלון'] },
    { category: 'Entertainment', keywords: ['entertainment', 'movie', 'cinema', 'concert', 'ticket', 'בילוי', 'סרט'] },
    { category: 'Health & Beauty', keywords: ['spa', 'massage', 'beauty', 'wellness', 'health', 'ספא', 'עיסוי', 'יופי', 'בריאות'] },
    { category: 'Electronics', keywords: ['electronics', 'electric', 'phone', 'laptop', 'computer', 'אלקטרונ', 'חשמל', 'מחשב'] },
    { category: 'Home & Garden', keywords: ['home', 'garden', 'furniture', 'kitchen', 'house', 'בית', 'גן', 'ריהוט', 'מטבח'] },
  ];

  let bestCategory: VoucherCategory | null = null;
  let bestScore = 0;
  let hasTie = false;

  for (const bucket of buckets) {
    const score = bucket.keywords.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);

    if (score > bestScore) {
      bestScore = score;
      bestCategory = bucket.category;
      hasTie = false;
    } else if (score > 0 && score === bestScore) {
      hasTie = true;
    }
  }

  if (!bestCategory || bestScore === 0 || hasTie) {
    return null;
  }

  return bestCategory;
}

function extractReadableText(bytes: Uint8Array): string {
  const decoded = new TextDecoder('latin1').decode(bytes);
  return decoded
    .replace(/[^\u0590-\u05FFa-zA-Z0-9$€₪:/_.#\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

function heuristicSuggestionFromText(input: {
  fileName: string;
  mimeType: string;
  text: string;
}): Suggestion {
  const source = `${removeFileExtension(input.fileName).replace(/[_-]+/g, ' ')} ${input.text}`;
  const voucherType = inferVoucherType(source);
  const category = inferCategoryFromText(source);
  const merchantName = extractMerchantNameFromText(source) ?? extractMerchantFromFileName(input.fileName);
  const productName = extractProductNameFromText(source);
  const faceValue = extractAmountFromText(source);
  const expiryDate = extractDateFromText(source);
  const code = extractCodeFromText(source);

  return {
    voucherType,
    category,
    merchantName,
    productName,
    faceValue: voucherType === 'monetary' ? faceValue : faceValue,
    usedValue: null,
    expiryDate,
    code,
    notes: null,
    confidence: 0.35,
    metadata: {
      source: 'heuristic_text',
      mimeType: input.mimeType,
    },
  };
}

function heuristicSuggestionFromFile(input: { fileName: string; mimeType: string; bytes: Uint8Array }): Suggestion {
  const textSample = extractReadableText(input.bytes);
  const source = `${removeFileExtension(input.fileName).replace(/[_-]+/g, ' ')} ${textSample}`;
  const voucherType = inferVoucherType(source);
  const category = inferCategoryFromText(source);
  const merchantName = extractMerchantFromFileName(input.fileName);
  const faceValue = extractAmountFromText(source);
  const expiryDate = extractDateFromText(source);
  const code = extractCodeFromText(source);

  return {
    voucherType,
    category,
    merchantName,
    productName: voucherType === 'product' ? removeFileExtension(input.fileName).replace(/[_-]+/g, ' ').trim() : null,
    faceValue: voucherType === 'monetary' ? faceValue : null,
    usedValue: null,
    expiryDate,
    code,
    notes: null,
    confidence: countSuggestedFields({
      ...emptySuggestion,
      voucherType,
      category,
      merchantName,
      faceValue: voucherType === 'monetary' ? faceValue : null,
      expiryDate,
      code,
      productName: voucherType === 'product' ? removeFileExtension(input.fileName).replace(/[_-]+/g, ' ').trim() : null,
      usedValue: null,
      notes: null,
      metadata: {},
      confidence: null,
    })
      ? 0.3
      : 0.15,
    metadata: {
      source: 'heuristic',
      mimeType: input.mimeType,
    },
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function fromBase64(base64Value: string): Uint8Array {
  const normalized = base64Value
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + length);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcBytes = new Uint8Array(typeBytes.length + data.length);
  crcBytes.set(typeBytes, 0);
  crcBytes.set(data, typeBytes.length);
  view.setUint32(8 + length, crc32(crcBytes));

  return chunk;
}

async function inflateDeflate(input: Uint8Array): Promise<Uint8Array> {
  async function attempt(format: CompressionFormat): Promise<Uint8Array | null> {
    try {
      const stream = new DecompressionStream(format);
      const writer = stream.writable.getWriter();
      await writer.write(input);
      await writer.close();
      const buffer = await new Response(stream.readable).arrayBuffer();
      return new Uint8Array(buffer);
    } catch (_error) {
      return null;
    }
  }

  const zlib = await attempt('deflate');

  if (zlib) {
    return zlib;
  }

  const raw = await attempt('deflate-raw');

  if (raw) {
    return raw;
  }

  throw new Error('Unable to decompress FlateDecode stream.');
}

async function deflateBytes(input: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate');
  const writer = stream.writable.getWriter();
  await writer.write(input);
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

function decodePngPredictorRows(input: {
  decoded: Uint8Array;
  columns: number;
  colors: number;
  bitsPerComponent: number;
}): Uint8Array | null {
  if (input.bitsPerComponent !== 8 || input.columns <= 0 || input.colors <= 0) {
    return null;
  }

  const bytesPerPixel = input.colors;
  const rowLength = input.columns * bytesPerPixel;
  const stride = rowLength + 1;

  if (stride <= 1 || input.decoded.length % stride !== 0) {
    return null;
  }

  const rows = input.decoded.length / stride;
  const output = new Uint8Array(rows * rowLength);

  for (let row = 0; row < rows; row += 1) {
    const sourceOffset = row * stride;
    const targetOffset = row * rowLength;
    const filter = input.decoded[sourceOffset];

    for (let x = 0; x < rowLength; x += 1) {
      const raw = input.decoded[sourceOffset + 1 + x];
      const left = x >= bytesPerPixel ? output[targetOffset + x - bytesPerPixel] : 0;
      const up = row > 0 ? output[targetOffset + x - rowLength] : 0;
      const upLeft = row > 0 && x >= bytesPerPixel ? output[targetOffset + x - rowLength - bytesPerPixel] : 0;

      let value = raw;

      if (filter === 1) {
        value = (raw + left) & 0xff;
      } else if (filter === 2) {
        value = (raw + up) & 0xff;
      } else if (filter === 3) {
        value = (raw + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (raw + predictor) & 0xff;
      }

      output[targetOffset + x] = value;
    }
  }

  return output;
}

async function encodePngFromRaw(input: {
  width: number;
  height: number;
  channels: number;
  raw: Uint8Array;
}): Promise<Uint8Array> {
  if (input.width <= 0 || input.height <= 0) {
    throw new Error('Invalid image dimensions.');
  }

  if (input.channels !== 1 && input.channels !== 3) {
    throw new Error('Unsupported channel count for PNG encoding.');
  }

  const expectedLength = input.width * input.height * input.channels;

  if (input.raw.length < expectedLength) {
    throw new Error('Image data is shorter than expected.');
  }

  const raw = input.raw.length === expectedLength ? input.raw : input.raw.slice(0, expectedLength);
  const rowLength = input.width * input.channels;
  const filtered = new Uint8Array((rowLength + 1) * input.height);

  for (let row = 0; row < input.height; row += 1) {
    const sourceOffset = row * rowLength;
    const targetOffset = row * (rowLength + 1);
    filtered[targetOffset] = 0;
    filtered.set(raw.subarray(sourceOffset, sourceOffset + rowLength), targetOffset + 1);
  }

  const compressed = await deflateBytes(filtered);
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, input.width);
  ihdrView.setUint32(4, input.height);
  ihdr[8] = 8;
  ihdr[9] = input.channels === 1 ? 0 : 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatBytes([signature, writeChunk('IHDR', ihdr), writeChunk('IDAT', compressed), writeChunk('IEND', new Uint8Array())]);
}

function readPdfNumber(header: string, key: string): number | null {
  const pattern = new RegExp(`/${key}\\s+(\\d+)`);
  const match = header.match(pattern);

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPdfStreamStart(text: string, streamKeywordIndex: number): number {
  let start = streamKeywordIndex + 'stream'.length;

  if (text[start] === '\r' && text[start + 1] === '\n') {
    start += 2;
  } else if (text[start] === '\r' || text[start] === '\n') {
    start += 1;
  }

  return start;
}

function extractPdfFilter(header: string): 'jpeg' | 'flate' | null {
  if (/\/Filter\s*\[(?:[^\]]*\/)?DCTDecode[^\]]*\]/.test(header) || /\/Filter\s*\/DCTDecode/.test(header)) {
    return 'jpeg';
  }

  if (/\/Filter\s*\[(?:[^\]]*\/)?FlateDecode[^\]]*\]/.test(header) || /\/Filter\s*\/FlateDecode/.test(header)) {
    return 'flate';
  }

  return null;
}

function extractPdfChannels(header: string): number | null {
  if (/\/ColorSpace\s*\/DeviceRGB/.test(header)) {
    return 3;
  }

  if (/\/ColorSpace\s*\/DeviceGray/.test(header)) {
    return 1;
  }

  return null;
}

function extractPdfPredictor(header: string): { columns: number; colors: number; bitsPerComponent: number } | null {
  const predictor = Number(header.match(/\/Predictor\s+(\d+)/)?.[1] ?? 0);
  const columns = Number(header.match(/\/Columns\s+(\d+)/)?.[1] ?? 0);
  const colors = Number(header.match(/\/Colors\s+(\d+)/)?.[1] ?? 0);
  const bitsPerComponent = Number(header.match(/\/BitsPerComponent\s+(\d+)/)?.[1] ?? 8);

  if (!Number.isFinite(predictor) || predictor < 10 || !Number.isFinite(columns) || columns <= 0) {
    return null;
  }

  return {
    columns,
    colors: Number.isFinite(colors) && colors > 0 ? colors : 0,
    bitsPerComponent: Number.isFinite(bitsPerComponent) && bitsPerComponent > 0 ? bitsPerComponent : 8,
  };
}

async function extractPdfImageDataUrls(pdfBytes: Uint8Array, maxImages = 2): Promise<string[]> {
  const pdfText = new TextDecoder('latin1').decode(pdfBytes);
  const objectPattern = /\d+\s+\d+\s+obj[\s\S]*?endobj/g;
  const candidates: Array<{ dataUrl: string; area: number }> = [];

  for (const match of pdfText.matchAll(objectPattern)) {
    const objectText = match[0];
    const objectStart = match.index ?? 0;

    if (!objectText.includes('/Subtype/Image')) {
      continue;
    }

    const width = readPdfNumber(objectText, 'Width');
    const height = readPdfNumber(objectText, 'Height');
    const bitsPerComponent = readPdfNumber(objectText, 'BitsPerComponent') ?? 8;
    const length = readPdfNumber(objectText, 'Length');
    const filter = extractPdfFilter(objectText);
    const channels = extractPdfChannels(objectText);
    const streamLocalIndex = objectText.indexOf('stream');

    if (!width || !height || !length || !filter || streamLocalIndex === -1) {
      continue;
    }

    if (width * height > MAX_PDF_IMAGE_PIXELS) {
      continue;
    }

    const streamStart = getPdfStreamStart(pdfText, objectStart + streamLocalIndex);
    const streamEnd = streamStart + length;

    if (streamEnd > pdfBytes.length) {
      continue;
    }

    const streamBytes = pdfBytes.slice(streamStart, streamEnd);

    if (streamBytes.length > MAX_INLINE_PDF_IMAGE_BYTES) {
      continue;
    }

    if (filter === 'jpeg') {
      candidates.push({
        dataUrl: `data:image/jpeg;base64,${toBase64(streamBytes)}`,
        area: width * height,
      });
      if (candidates.length >= maxImages) {
        break;
      }
      continue;
    }

    if (ENABLE_PDF_FLATE_IMAGE_EXTRACTION && filter === 'flate' && channels && bitsPerComponent === 8) {
      try {
        const inflated = await inflateDeflate(streamBytes);
        const expected = width * height * channels;
        let pixelBytes: Uint8Array | null = null;

        if (inflated.length >= expected) {
          pixelBytes = inflated.length === expected ? inflated : inflated.slice(0, expected);
        } else {
          const predictor = extractPdfPredictor(objectText);

          if (predictor) {
            pixelBytes = decodePngPredictorRows({
              decoded: inflated,
              columns: predictor.columns || width,
              colors: predictor.colors || channels,
              bitsPerComponent: predictor.bitsPerComponent || bitsPerComponent,
            });
          }
        }

        if (!pixelBytes || pixelBytes.length < expected) {
          continue;
        }

        const pngBytes = await encodePngFromRaw({
          width,
          height,
          channels,
          raw: pixelBytes.length === expected ? pixelBytes : pixelBytes.slice(0, expected),
        });

        candidates.push({
          dataUrl: `data:image/png;base64,${toBase64(pngBytes)}`,
          area: width * height,
        });
        if (candidates.length >= maxImages) {
          break;
        }
      } catch (_error) {
        // Best-effort only.
      }
    }
  }

  return candidates
    .sort((left, right) => right.area - left.area)
    .slice(0, maxImages)
    .map((candidate) => candidate.dataUrl);
}

function extractTextFromResponsePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const direct = (payload as { output_text?: unknown }).output_text;

  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const output = (payload as { output?: unknown }).output;

  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }

      const maybeText = (part as { text?: unknown }).text;
      const maybeOutputText = (part as { output_text?: unknown }).output_text;
      const maybeRefusal = (part as { refusal?: unknown }).refusal;

      if (typeof maybeText === 'string' && maybeText.trim()) {
        return maybeText.trim();
      }

      if (typeof maybeOutputText === 'string' && maybeOutputText.trim()) {
        return maybeOutputText.trim();
      }

      if (typeof maybeRefusal === 'string' && maybeRefusal.trim()) {
        return maybeRefusal.trim();
      }
    }
  }

  return null;
}

function extractSuggestionFromResponsePayload(payload: unknown): Suggestion | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  const topLevelCandidates: unknown[] = [record.output_parsed, record.parsed];

  for (const candidate of topLevelCandidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const normalized = normalizeSuggestion(candidate);

      if (countSuggestedFields(normalized) > 0) {
        return normalized;
      }
    }
  }

  const output = record.output;

  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }

      const suggestionObject =
        (part as { json?: unknown }).json ??
        (part as { parsed?: unknown }).parsed ??
        (part as { value?: unknown }).value;

      if (!suggestionObject || typeof suggestionObject !== 'object' || Array.isArray(suggestionObject)) {
        continue;
      }

      const normalized = normalizeSuggestion(suggestionObject);

      if (countSuggestedFields(normalized) > 0) {
        return normalized;
      }
    }
  }

  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function extractWithOpenAi(input: {
  apiKey: string;
  model: string;
  ocrModel: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  hintText?: string;
}): Promise<Suggestion | null> {
  const base64Payload = toBase64(input.bytes);
  const dataUrl = `data:${input.mimeType};base64,${base64Payload}`;
  const pdfImageDataUrlsRaw =
    input.mimeType === 'application/pdf' && input.bytes.length <= MAX_PDF_BYTES_FOR_IMAGE_EXTRACTION
      ? await extractPdfImageDataUrls(input.bytes, 1).catch((_error) => [])
      : [];
  const pdfImageDataUrls = pdfImageDataUrlsRaw.filter((value) => value.length <= MAX_INLINE_IMAGE_DATA_URL_CHARS);
  const canUseInlinePdfImage = input.mimeType === 'application/pdf' && pdfImageDataUrls.length > 0;

  async function uploadFileToOpenAiForResponses(): Promise<string | null> {
    const form = new FormData();
    form.append('purpose', 'user_data');
    form.append('file', new Blob([input.bytes], { type: input.mimeType }), input.fileName);

    try {
      const uploadResponse = await fetchWithTimeout(
        'https://api.openai.com/v1/files',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
          },
          body: form,
        },
        OPENAI_FETCH_TIMEOUT_MS,
      );

      if (!uploadResponse.ok) {
        const body = await uploadResponse.text();
        console.warn(`[extract-voucher-draft] OpenAI file upload failed: ${uploadResponse.status} ${body.slice(0, 200)}`);
        return null;
      }

      const payload = (await uploadResponse.json()) as { id?: unknown };
      const fileId = typeof payload.id === 'string' ? payload.id : '';

      if (!fileId) {
        return null;
      }

      return fileId;
    } catch (error) {
      console.warn('[extract-voucher-draft] OpenAI file upload request failed:', error);
      return null;
    }
  }

  async function deleteOpenAiFile(fileId: string): Promise<void> {
    try {
      await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
        },
      });
    } catch (_error) {
      // Best-effort cleanup only.
    }
  }

  const useUploadedFile = input.mimeType === 'application/pdf' && !canUseInlinePdfImage;
  let uploadedFileId: string | null = null;

  async function postOpenAiResponse(body: Record<string, unknown>): Promise<unknown | null> {
    try {
      const response = await fetchWithTimeout(
        'https://api.openai.com/v1/responses',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        OPENAI_FETCH_TIMEOUT_MS,
      );

      if (!response.ok) {
        const text = await response.text();
        console.warn(`[extract-voucher-draft] OpenAI response failed: ${response.status} ${text.slice(0, 200)}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('[extract-voucher-draft] OpenAI request failed:', error);
      return null;
    }
  }

  function parseStructuredSuggestion(modelText: string): Suggestion | null {
    const stripped = modelText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const direct = (() => {
      try {
        return normalizeSuggestion(JSON.parse(stripped));
      } catch (_error) {
        return null;
      }
    })();

    if (direct) {
      return direct;
    }

    const objectMatch = stripped.match(/\{[\s\S]*\}/);

    if (!objectMatch) {
      return null;
    }

    try {
      return normalizeSuggestion(JSON.parse(objectMatch[0]));
    } catch (_error) {
      return null;
    }
  }

  function parseSuggestionFromModelText(modelText: string): Suggestion | null {
    const structured = parseStructuredSuggestion(modelText);

    if (structured) {
      return structured;
    }

    const textFallback = heuristicSuggestionFromText({
      fileName: input.fileName,
      mimeType: input.mimeType,
      text: modelText,
    });

    if (!countSuggestedFields(textFallback)) {
      return null;
    }

    return {
      ...textFallback,
      metadata: {
        ...textFallback.metadata,
        source: 'openai_unstructured_text',
        rawTextSample: sanitizeText(modelText, 1200),
      },
      confidence: textFallback.confidence ?? 0.3,
    };
  }

  try {
    if (useUploadedFile) {
      uploadedFileId = await uploadFileToOpenAiForResponses();
    }

    const documentInputs: Array<Record<string, unknown>> = [];

    if (input.mimeType.startsWith('image/')) {
      documentInputs.push({
        type: 'input_image',
        image_url: dataUrl,
      });
    } else {
      for (const imageDataUrl of pdfImageDataUrls.slice(0, 1)) {
        documentInputs.push({
          type: 'input_image',
          image_url: imageDataUrl,
        });
      }

      if (uploadedFileId) {
        documentInputs.push({
          type: 'input_file',
          file_id: uploadedFileId,
        });
      } else {
        documentInputs.push({
          type: 'input_file',
          filename: input.fileName,
          file_data: base64Payload,
        });
      }
    }

    async function requestVisibleTextForOcr(): Promise<{ text: string; modelUsed: string } | null> {
      const ocrModels = Array.from(new Set([input.ocrModel, input.model, 'gpt-4o'].filter(Boolean)));
      const ocrUserContent: Array<Record<string, unknown>> = [
        {
          type: 'input_text',
          text:
            'Perform OCR on this voucher document and return raw visible text only. ' +
            'Preserve original language, numbers, punctuation, and line breaks. ' +
            'Do not infer or summarize.',
        },
        ...documentInputs,
      ];

      for (const ocrModelCandidate of ocrModels) {
        const ocrPayload = await postOpenAiResponse({
          model: ocrModelCandidate,
          max_output_tokens: 1200,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    'You are an OCR transcription step for voucher documents. ' +
                    'Return plain text only (no JSON). Copy only what is visually present. ' +
                    'Keep Hebrew/English exactly as-is and preserve line breaks when possible. ' +
                    'Do not translate, classify, summarize, or guess missing text.',
                },
              ],
            },
            {
              role: 'user',
              content: ocrUserContent,
            },
          ],
        });

        if (!ocrPayload) {
          continue;
        }

        const extractedText = extractTextFromResponsePayload(ocrPayload);
        const normalized = sanitizeText(extractedText, 12000);

        if (normalized && normalized.length > 0) {
          return {
            text: normalized,
            modelUsed: ocrModelCandidate,
          };
        }
      }

      return null;
    }

    async function extractFieldsFromText(ocrText: string): Promise<Suggestion | null> {
      const truncatedText = sanitizeText(ocrText, 12000) ?? ocrText.slice(0, 12000);
      let payload = await postOpenAiResponse({
        model: input.model,
        text: {
          format: {
            type: 'json_schema',
            name: 'voucher_draft_suggestion',
            schema: OPENAI_SUGGESTION_JSON_SCHEMA,
            strict: true,
          },
        },
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'Map OCR text into voucher draft JSON. Return JSON only. ' +
                  'Primary extraction targets: voucherType, category, merchantName, productName, faceValue, expiryDate, code. ' +
                  'Prefer null over guessing. ' +
                  'category must be one of: Groceries, Dining, Shopping, Travel, Entertainment, Health & Beauty, Electronics, Home & Garden, Other. ' +
                  'If category is unclear, return null. ' +
                  'Rules: merchantName is the business/brand; productName is the specific product/service; ' +
                  'code is a redeem/voucher identifier; faceValue is an explicit monetary amount only; ' +
                  'expiryDate is only a date explicitly tied to expiry/validity/end-date (never purchase/issue/transaction date). ' +
                  'If multiple candidate numbers/dates/codes exist and labeling is unclear, return null for that field. ' +
                  'voucherType=monetary only with explicit money/balance/value context; ' +
                  'voucherType=product only with explicit product/service entitlement; otherwise null. ' +
                  'When confidence is low, keep fields null. ' +
                  'usedValue and notes should be null unless explicitly present.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  'Return this schema exactly: ' +
                  '{voucherType, category, merchantName, productName, faceValue, usedValue, expiryDate, code, notes, confidence, metadata}. ' +
                  'Few-shot guidance: ' +
                  'Example A OCR: "Gift Card | ABC Market | Value 200 ILS | Valid until 31/12/2026 | Code AB12CD34" ' +
                  '-> voucherType=monetary, category=Shopping, merchantName="ABC Market", productName=null, faceValue=200, expiryDate="2026-12-31", code="AB12CD34". ' +
                  'Example B OCR: "זכאות: עיסוי 50 דקות | רשת ספא נירוונה | בתוקף עד 15/08/2026 | קוד SPA7788" ' +
                  '-> voucherType=product, category=Health & Beauty, merchantName="רשת ספא נירוונה", productName="עיסוי 50 דקות", faceValue=null, expiryDate="2026-08-15", code="SPA7788". ' +
                  'If unsure, return null for the field.',
              },
              {
                type: 'input_text',
                text: `OCR text:\n${truncatedText}`,
              },
              {
                type: 'input_text',
                text: input.hintText
                  ? `Optional hint from raw bytes: ${input.hintText}`
                  : 'No extra hint.',
              },
            ],
          },
        ],
      });

      if (!payload) {
        // Fallback for models/accounts that fail on strict json_schema.
        payload = await postOpenAiResponse({
          model: input.model,
          max_output_tokens: 900,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    'Map OCR text into voucher draft JSON. Return JSON only. ' +
                    'Extract conservatively: voucherType, category, merchantName, productName, faceValue, expiryDate, code. ' +
                    'category must be one of: Groceries, Dining, Shopping, Travel, Entertainment, Health & Beauty, Electronics, Home & Garden, Other. ' +
                    'Prefer null over guessing. Do not invent values.',
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text:
                    'Return this JSON object keys exactly: ' +
                    'voucherType, category, merchantName, productName, faceValue, usedValue, expiryDate, code, notes, confidence, metadata. ' +
                    'expiryDate must be YYYY-MM-DD when present and explicitly marked as expiry/validity. ' +
                    'Do not use purchase/issue dates. If ambiguous, return null.',
                },
                {
                  type: 'input_text',
                  text: `OCR text:\n${truncatedText}`,
                },
              ],
            },
          ],
        });
      }

      if (!payload) {
        return null;
      }

      const structured = extractSuggestionFromResponsePayload(payload);

      if (structured) {
        return structured;
      }

      const modelText = extractTextFromResponsePayload(payload);

      if (!modelText) {
        return null;
      }

      return parseSuggestionFromModelText(modelText);
    }

    const ocrResult = await requestVisibleTextForOcr();
    let textDrivenSuggestion: Suggestion | null = null;

    if (ocrResult) {
      const aiFromText = await extractFieldsFromText(ocrResult.text);
      const heuristicFromText = heuristicSuggestionFromText({
        fileName: input.fileName,
        mimeType: input.mimeType,
        text: ocrResult.text,
      });

      if (aiFromText) {
        textDrivenSuggestion = mergeSuggestions(aiFromText, heuristicFromText);
      } else if (countSuggestedFields(heuristicFromText) > 0) {
        textDrivenSuggestion = heuristicFromText;
      }

      if (textDrivenSuggestion) {
        textDrivenSuggestion.metadata = {
          ...textDrivenSuggestion.metadata,
          ocrTextSample: sanitizeText(ocrResult.text, 1200),
          ocrModelUsed: ocrResult.modelUsed,
          source: textDrivenSuggestion.metadata.source ?? 'openai_ocr_text',
        };
      }
    }

    return textDrivenSuggestion;
  } finally {
    if (uploadedFileId) {
      await deleteOpenAiFile(uploadedFileId);
    }
  }
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

async function resolveUserFromRequest(admin: SupabaseClient, req: Request): Promise<{ id: string } | null> {
  const token = readBearerToken(req);

  if (!token) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    console.warn('[extract-voucher-draft] auth.getUser failed:', error?.message ?? 'no user');
    return null;
  }

  return { id: data.user.id };
}

async function assertWalletMembership(admin: SupabaseClient, walletId: string, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('wallet_members')
    .select('id')
    .eq('wallet_id', walletId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate wallet membership: ${error.message}`);
  }

  return Boolean(data);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  let body: ExtractRequestBody;

  try {
    body = (await req.json()) as ExtractRequestBody;
  } catch (_error) {
    return jsonResponse(400, { error: 'Invalid JSON payload.' });
  }

  const walletId = sanitizeText(body.walletId, 128);
  const storageBucket = sanitizeText(body.storageBucket, 64);
  const storagePath = sanitizeText(body.storagePath, 512);
  const fileName = sanitizeText(body.fileName, 255) ?? 'voucher-file';
  const mimeType = sanitizeText(body.mimeType, 128) ?? 'application/octet-stream';
  const fileBase64 = sanitizeText(body.fileBase64, 16 * 1024 * 1024);

  if (!walletId) {
    return jsonResponse(400, {
      error: 'walletId is required.',
    });
  }

  try {
    const admin = createAdminClient();
    const user = await resolveUserFromRequest(admin, req);

    if (!user) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const isWalletMember = await assertWalletMembership(admin, walletId, user.id);

    if (!isWalletMember) {
      return jsonResponse(403, { error: 'Forbidden' });
    }

    let bytes: Uint8Array;

    if (fileBase64) {
      bytes = fromBase64(fileBase64);
    } else {
      if (!storageBucket || !storagePath) {
        return jsonResponse(400, {
          error: 'Either fileBase64 or (storageBucket + storagePath) must be provided.',
        });
      }

      const { data: fileBlob, error: downloadError } = await admin.storage.from(storageBucket).download(storagePath);

      if (downloadError || !fileBlob) {
        return jsonResponse(400, {
          error: `Failed to download attachment for extraction: ${downloadError?.message ?? 'unknown error'}`,
        });
      }

      bytes = new Uint8Array(await fileBlob.arrayBuffer());
    }
    const warnings: string[] = [];
    const heuristic = heuristicSuggestionFromFile({ fileName, mimeType, bytes });
    let suggestion = heuristic;
    let method: 'openai' | 'heuristic' = 'heuristic';

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const openAiModel = resolveConfiguredModel(Deno.env.get('OPENAI_VOUCHER_EXTRACTION_MODEL'), 'gpt-4o');
    const fallbackOpenAiModel = resolveConfiguredModel(Deno.env.get('OPENAI_VOUCHER_EXTRACTION_FALLBACK_MODEL'), 'gpt-4o');
    const openAiOcrModel = resolveConfiguredModel(Deno.env.get('OPENAI_VOUCHER_EXTRACTION_OCR_MODEL'), 'gpt-4o');
    const canAttemptOpenAi = Boolean(openAiKey && bytes.length > 0 && bytes.length <= MAX_OPENAI_BYTES);
    const supportsOpenAiFileType = mimeType.startsWith('image/') || mimeType === 'application/pdf';
    const modelCandidates = Array.from(new Set([openAiModel, fallbackOpenAiModel, 'gpt-4o'].filter((value): value is string => Boolean(value)))).slice(0, 2);

    if (canAttemptOpenAi && supportsOpenAiFileType) {
      try {
        let bestSuggestion: Suggestion | null = null;
        let bestModel = '';
        const modelsWithNoUsableSuggestion: string[] = [];

        for (const modelCandidate of modelCandidates) {
          try {
            const candidate = await extractWithOpenAi({
              apiKey: openAiKey as string,
              model: modelCandidate,
              ocrModel: openAiOcrModel,
              fileName,
              mimeType,
              bytes,
              hintText: extractReadableText(bytes).slice(0, 1500),
            });

            if (candidate) {
              if (
                !bestSuggestion ||
                countCoreFields(candidate) > countCoreFields(bestSuggestion) ||
                (countCoreFields(candidate) === countCoreFields(bestSuggestion) && countSuggestedFields(candidate) > countSuggestedFields(bestSuggestion))
              ) {
                bestSuggestion = candidate;
                bestModel = modelCandidate;
              }

              if (!isWeakExtraction(candidate)) {
                break;
              }
            } else {
              modelsWithNoUsableSuggestion.push(modelCandidate);
            }
          } catch (candidateError) {
            console.error(`[extract-voucher-draft] OpenAI extraction failed for model ${modelCandidate}:`, candidateError);
            modelsWithNoUsableSuggestion.push(modelCandidate);
          }
        }

        if (bestSuggestion) {
          method = 'openai';
          suggestion = mergeSuggestions(bestSuggestion, heuristic);
          const rawTextSample = sanitizeText((bestSuggestion.metadata as { rawTextSample?: unknown }).rawTextSample, 1200);

          if (rawTextSample) {
            const textHeuristic = heuristicSuggestionFromText({
              fileName,
              mimeType,
              text: rawTextSample,
            });
            suggestion = mergeSuggestions(suggestion, textHeuristic);
          }

          if (bestModel) {
            warnings.push(`OpenAI model used: ${bestModel}`);
          }

          if (isWeakExtraction(suggestion)) {
            warnings.push('OpenAI extraction was weak (mostly code).');
          }
        } else {
          warnings.push(
            modelsWithNoUsableSuggestion.length > 0
              ? `OpenAI returned no usable suggestion for models: ${modelsWithNoUsableSuggestion.join(', ')}. Heuristic fallback was used.`
              : 'OpenAI returned no structured suggestion. Heuristic fallback was used.',
          );
        }
      } catch (error) {
        console.error('[extract-voucher-draft] OpenAI extraction failed:', error);
        warnings.push('OpenAI extraction failed. Heuristic fallback was used.');
      }
    } else if (!openAiKey) {
      warnings.push('OPENAI_API_KEY is not configured. Heuristic extraction was used.');
    } else if (!supportsOpenAiFileType) {
      warnings.push(`Unsupported mime type for OpenAI extraction: ${mimeType}. Heuristic extraction was used.`);
    } else if (bytes.length > MAX_OPENAI_BYTES) {
      warnings.push('Attachment is too large for OpenAI extraction in MVP mode. Heuristic extraction was used.');
    }

    if (!countSuggestedFields(suggestion)) {
      warnings.push('No clear fields were extracted.');
    }

    return jsonResponse(200, {
      suggestion,
      metadata: {
        method,
        warnings,
      },
    });
  } catch (error) {
    console.error('[extract-voucher-draft] fatal error:', error);

    return jsonResponse(500, {
      error: 'Failed to extract voucher details.',
      suggestion: emptySuggestion,
      metadata: {
        method: 'heuristic',
        warnings: ['Extraction failed unexpectedly.'],
      },
    });
  }
});
