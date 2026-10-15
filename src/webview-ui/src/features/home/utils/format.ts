/**
 * ------------------------------------------------------------------
 * format (home utils)
 * ------------------------------------------------------------------
 * Kiểu dữ liệu và helper dùng chung cho các card trên trang Home.
 *
 * Main features:
 * - AccountStat: thống kê tokens/requests theo account
 * - formatTokens: rút gọn số tokens (1200 → 1.2k)
 * - ACCOUNT_COLORS: bảng màu dùng chung theo thứ hạng account
 * ------------------------------------------------------------------
 */

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface AccountStat {
  id: string;
  email: string;
  provider_id: string;
  total_requests: number | null;
  total_tokens: number | null;
}

// ─── Constants ──────────────────────────────────────────────────────────
/** Màu theo thứ hạng account; dùng chung để khớp nhau. */
export const ACCOUNT_COLORS = [
  "var(--vscode-textLink-foreground, #3b82f6)",
  "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
  "var(--vscode-symbolIcon-namespaceForeground, #8b5cf6)",
  "var(--vscode-editorWarning-foreground, #d97706)",
  "var(--vscode-errorForeground, #f43f5e)",
];

// ─── Helpers ────────────────────────────────────────────────────────────
/** Rút gọn số tokens: 1200 → 1.2k, 3400000 → 3.4M. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
