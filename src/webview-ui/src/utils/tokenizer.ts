/**
 * ------------------------------------------------------------------
 * Tokenizer
 * ------------------------------------------------------------------
 * Token counting sử dụng tiktoken (cl100k_base encoding).
 * Hỗ trợ đếm token cho string và message array.
 *
 * Main functions:
 * - countTokens()         : Đếm token trong string
 * - countMessagesTokens() : Đếm token trong array messages
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { getEncoding, TiktokenEncoding } from 'js-tiktoken';

const ENCODING_NAME: TiktokenEncoding = 'cl100k_base';
let encoding: any = null;

try {
  encoding = getEncoding(ENCODING_NAME);
} catch (error) {
}

// ─── Functions ──────────────────────────────────────────────────────────

export function countTokens(text: string): number {
  if (!text) return 0;
  if (!encoding) {
    return Math.ceil(text.length / 4);
  }

  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    return Math.ceil(text.length / 4);
  }
}

export function countMessagesTokens(messages: any[]): number {
  let totalTokens = 0;

  for (const message of messages) {
    if (message.content) {
      totalTokens += countTokens(message.content);
    }
    totalTokens += 4;
  }

  return totalTokens;
}