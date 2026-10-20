/**
 * ------------------------------------------------------------------
 * useDbFetch
 * ------------------------------------------------------------------
 * Hook trả về hàm `dbFetch(path, init?)` gọi AIWeb2API backend với:
 * - Base URL lấy từ `SettingsContext` (apiUrl).
 * - Header `Content-Type: application/json` tự thêm khi có body.
 *
 * Thay thế các định nghĩa `dbFetch` bị lặp ở nhiều component trước đây.
 *
 * Usage:
 *   const dbFetch = useDbFetch();
 *   const res = await dbFetch("/v1/accounts");
 * ------------------------------------------------------------------
 */

import { useCallback } from "react";
import { useSettings } from "../context/SettingsContext";

/** Signature của hàm fetch trả về — dùng chung cho mọi component. */
export type DbFetch = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Trả về hàm fetch đã gắn sẵn base URL.
 *
 * @returns Hàm `dbFetch(path, init?)`. `path` bắt đầu bằng "/".
 */
export const useDbFetch = (): DbFetch => {
  const { apiUrl } = useSettings();

  return useCallback(
    (path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type") && init?.body) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(`${apiUrl}${path}`, { ...init, headers });
    },
    [apiUrl],
  );
};