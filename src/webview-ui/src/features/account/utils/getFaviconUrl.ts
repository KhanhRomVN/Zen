/**
 * ------------------------------------------------------------------
 * getFaviconUrl
 * ------------------------------------------------------------------
 * Lấy URL favicon của một website từ địa chỉ được cung cấp.

 * Main functions:
 * - getFaviconUrl() : Trả về favicon URL, hoặc chuỗi rỗng nếu không hợp lệ
 * ------------------------------------------------------------------
 */

// ─── Functions ──────────────────────────────────────────────────────────
export const getFaviconUrl = (website: string): string => {
  if (!website) return "";
  try {
    const url = new URL(website);
    return `${url.origin}/favicon.ico`;
  } catch {
    return "";
  }
};