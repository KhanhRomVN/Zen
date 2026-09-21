/**
 * ------------------------------------------------------------------
 * useDbFetch
 * ------------------------------------------------------------------
 * Hook trả về hàm `dbFetch(path, init?)` gọi AIWeb2API backend với:
 * - Base URL lấy từ `SettingsContext` (apiUrl).
 * - Header `x-database-manager-id` tự động gắn theo active database
 *   của workspace (nếu có).
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

/** Header name dùng để truyền database manager ID. */
export const DB_MANAGER_HEADER = "x-database-manager-id";

/** Signature của hàm fetch trả về — dùng chung cho mọi component. */
export type DbFetch = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Trả về hàm fetch đã gắn sẵn base URL + database manager header.
 *
 * @returns Hàm `dbFetch(path, init?)`. `path` bắt đầu bằng "/".
 */
export const useDbFetch = (): DbFetch => {
  const { apiUrl, activeDatabaseManagerId } = useSettings();

  return useCallback(
    (path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type") && init?.body) {
        headers.set("Content-Type", "application/json");
      }
      if (activeDatabaseManagerId) {
        headers.set(DB_MANAGER_HEADER, activeDatabaseManagerId);
      }
      return fetch(`${apiUrl}${path}`, { ...init, headers });
    },
    [apiUrl, activeDatabaseManagerId],
  );
};