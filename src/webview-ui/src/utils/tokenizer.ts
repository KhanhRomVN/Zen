/**
 * ------------------------------------------------------------------
 * Tokenizer
 * ------------------------------------------------------------------
 * Token counting sử dụng tiktoken (cl100k_base encoding).
 * Hỗ trợ đếm token cho string và message array.
 *
 * Main functions:
 * - countTokens()         : Đếm token trong string
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { getEncoding, TiktokenEncoding } from "js-tiktoken";

const ENCODING_NAME: TiktokenEncoding = "cl100k_base";
let encoding: any = null;

try {
  encoding = getEncoding(ENCODING_NAME);
} catch (error) {}

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

/**
 * Format token count to human-readable string with K/M/B suffix.
 * Uses Math.round for consistent display across all components.
 * Examples: 39500 → "40K", 1500000 → "2M"
 */
export const formatTokenCount = (count: number): string => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${Math.round(count / 1000)}K`;
  if (count < 1000000000) return `${Math.round(count / 1000000)}M`;
  return `${Math.round(count / 1000000000)}B`;
};
