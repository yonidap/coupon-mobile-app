import type { ExpoPushMessage, ExpoPushTicket, TokenSendResult } from './types.ts';

/**
 * Expo Push Notification API wrapper.
 *
 * This module encapsulates all communication with the Expo push API so the
 * rest of the pipeline can treat delivery as a black box and focus on
 * business logic (selection, idempotency, persistence).
 *
 * BATCHING
 * ────────
 * Expo recommends sending at most 100 messages per request. This module
 * chunks larger batches automatically and returns a flat array of results
 * in the same order as the input messages.
 *
 * ERROR HANDLING
 * ──────────────
 * HTTP-level errors (network failure, Expo 5xx) are caught and returned as
 * error tickets rather than thrown. This ensures a single chunk failure
 * does not abort delivery for other chunks in the same batch.
 *
 * RECEIPT CHECKING (NOT IMPLEMENTED)
 * ───────────────────────────────────
 * Expo's delivery pipeline is asynchronous. A ticket with status='ok' means
 * Expo accepted the message, not that it was delivered. To confirm delivery
 * to APNs/FCM, implement a second job that calls:
 *   POST https://exp.host/--/api/v2/push/getReceipts
 * with the ticket IDs stored in voucher_reminders. See REMINDER_FLOW.md for
 * the recommended implementation path.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo recommends batches of at most 100 messages per request. */
const EXPO_CHUNK_SIZE = 100;

/**
 * Returns true when the token string looks like a valid Expo push token.
 * Does not guarantee the token is active — only prevents obviously malformed
 * tokens from being submitted to the API.
 */
export function isValidExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * Sends a single chunk of messages (≤ EXPO_CHUNK_SIZE) to the Expo API.
 * Throws on HTTP-level failure; individual per-message errors are returned
 * as error tickets in the response array.
 */
async function sendChunk(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(could not read body)');
    throw new Error(`Expo push API HTTP ${response.status}: ${body}`);
  }

  const json = await response.json();

  if (!json?.data || !Array.isArray(json.data)) {
    throw new Error(`Expo push API returned unexpected response shape: ${JSON.stringify(json)}`);
  }

  return json.data as ExpoPushTicket[];
}

/**
 * Sends push notifications for an array of messages and returns one
 * TokenSendResult per input message, in the same order.
 *
 * Never throws — HTTP-level chunk errors are captured and turned into
 * error tickets so the caller can continue processing other messages.
 */
export async function sendPushBatch(messages: ExpoPushMessage[]): Promise<TokenSendResult[]> {
  const results: TokenSendResult[] = [];

  for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
    const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
    let tickets: ExpoPushTicket[];

    try {
      tickets = await sendChunk(chunk);
    } catch (err) {
      // Chunk-level failure: manufacture error tickets for all messages in
      // this chunk so the rest of the batch is unaffected.
      const errorMessage = err instanceof Error ? err.message : String(err);
      tickets = chunk.map(() => ({
        status: 'error' as const,
        message: `Chunk HTTP error: ${errorMessage}`,
      }));
    }

    for (let j = 0; j < chunk.length; j++) {
      results.push({
        token: chunk[j].to,
        // If the API returned fewer tickets than messages (should not happen
        // per spec), substitute a synthetic error ticket.
        ticket: tickets[j] ?? {
          status: 'error' as const,
          message: 'Expo API returned fewer tickets than messages in chunk',
        },
      });
    }
  }

  return results;
}
