/**
 * ------------------------------------------------------------------
 * Client ID
 * ------------------------------------------------------------------
 * Sinh và lưu 1 ID ổn định cho mỗi webview instance (mỗi cửa sổ VSCode
 * có sessionStorage riêng). Dùng để backend phân biệt cửa sổ nào đang
 * active account nào.
 * ------------------------------------------------------------------
 */

const STORAGE_KEY = "zen-client-id";

/**
 * Lấy clientId ổn định của webview hiện tại. Tạo mới nếu chưa có.
 */
export function getClientId(): string {
  try {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      const uuid =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `zen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      id = uuid;
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `zen-fallback-${Date.now()}`;
  }
}