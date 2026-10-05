/**
 * ------------------------------------------------------------------
 * useSessionCleanup
 * ------------------------------------------------------------------
 * Health-check định kỳ để xóa toàn bộ conversation (chat session) phía
 * provider khi account không còn ở chat view.
 *
 * Cơ chế:
 * - Khi `isInChatView = true` + `supportsSessionCleanup = true`:
 *   Hook KHÔNG làm gì (account đang được dùng).
 * - Khi `isInChatView = false` (component unmount / đổi view):
 *   Gọi `POST /v1/accounts/:id/session-cleanup` 1 lần để dọn sạch.
 * - Ngoài ra, khi component mount với `isInChatView = false` cũng sẽ
 *   trigger cleanup ngay lập tức (trường hợp app khởi động lại).
 *
 * Provider hỗ trợ: field `supports_session_cleanup: true` trong
 * response của `GET /v1/providers`. Hiện tại: DeepSeek.
 * Provider khác muốn hỗ trợ chỉ cần implement `deleteAllSessions()`.
 *
 * Params:
 * - apiUrl              : Base URL của AIWeb2API
 * - accountId           : ID của account đang được dùng
 * - providerId          : Provider ID của account (để check supports_session_cleanup)
 * - providers           : Danh sách provider từ GET /v1/providers (đã fetch)
 * - isInChatView        : true khi component chat đang active (user đang dùng)
 * - isStreaming          : true khi đang streaming — không cleanup trong lúc stream
 * ------------------------------------------------------------------
 */

import { useEffect, useRef, useCallback } from "react";

interface UseSessionCleanupOptions {
  apiUrl: string;
  accountId: string | null | undefined;
  providerId: string | null | undefined;
  providers: any[];
  isInChatView: boolean;
  isStreaming: boolean;
}

/**
 * Kiểm tra provider có hỗ trợ session cleanup không.
 */
function providerSupportsCleanup(
  providerId: string | null | undefined,
  providers: any[],
): boolean {
  if (!providerId) return false;
  const p = providers.find(
    (pr: any) => pr.provider_id?.toLowerCase() === providerId.toLowerCase(),
  );
  return p?.supports_session_cleanup === true;
}

export function useSessionCleanup({
  apiUrl,
  accountId,
  providerId,
  providers,
  isInChatView,
  isStreaming,
}: UseSessionCleanupOptions): void {
  // Ref để luôn đọc được giá trị mới nhất trong cleanup callback (tránh stale closure)
  const accountIdRef = useRef(accountId);
  const providerIdRef = useRef(providerId);
  const providersRef = useRef(providers);
  const apiUrlRef = useRef(apiUrl);
  const isStreamingRef = useRef(isStreaming);

  accountIdRef.current = accountId;
  providerIdRef.current = providerId;
  providersRef.current = providers;
  apiUrlRef.current = apiUrl;
  isStreamingRef.current = isStreaming;

  // Ref để track account trước đó — khi user đổi sang account khác thì cleanup account cũ
  const prevAccountIdRef = useRef<string | null | undefined>(null);
  const prevProviderIdRef = useRef<string | null | undefined>(null);

  /**
   * Gọi session-cleanup API cho account/provider chỉ định.
   * Fire-and-forget: không block UI, lỗi được log ra console.
   */
  const triggerCleanup = useCallback(
    (targetAccountId: string, targetProviderId: string) => {
      const url = apiUrlRef.current;
      if (!url || !targetAccountId) return;

      // Double-check provider hỗ trợ trước khi gọi
      if (!providerSupportsCleanup(targetProviderId, providersRef.current)) {
        return;
      }

      fetch(`${url}/v1/accounts/${targetAccountId}/session-cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((body: any) => {
              console.warn(
                `[SessionCleanup] Failed — account=${targetAccountId} status=${res.status} msg=${body?.message}`,
              );
            });
          }
        })
        .catch((err) => {
          console.warn(
            `[SessionCleanup] Network error — account=${targetAccountId}`,
            err,
          );
        });
    },
    [],
  );

  // ─── Effect: Cleanup khi rời chat view (unmount hoặc isInChatView → false) ───

  useEffect(() => {
    // Khi không còn ở chat view, cleanup ngay nếu không đang stream
    if (!isInChatView && !isStreaming) {
      const aid = accountIdRef.current;
      const pid = providerIdRef.current;
      if (aid && pid) {
        triggerCleanup(aid, pid);
      }
    }
  }, [isInChatView, isStreaming, triggerCleanup]);

  // ─── Effect: Cleanup khi component unmount ────────────────────────────────

  useEffect(() => {
    return () => {
      // Component unmount: chạy cleanup nếu không đang stream
      if (!isStreamingRef.current) {
        const aid = accountIdRef.current;
        const pid = providerIdRef.current;
        if (aid && pid) {
          triggerCleanup(aid, pid);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Effect: Cleanup account cũ khi user đổi sang account khác ───────────

  useEffect(() => {
    const prevAid = prevAccountIdRef.current;
    const prevPid = prevProviderIdRef.current;

    // Nếu account vừa thay đổi và có account cũ → cleanup account cũ
    if (prevAid && prevPid && prevAid !== accountId && !isStreaming) {
      triggerCleanup(prevAid, prevPid);
    }

    prevAccountIdRef.current = accountId;
    prevProviderIdRef.current = providerId;
  }, [accountId, providerId, isStreaming, triggerCleanup]);
}
