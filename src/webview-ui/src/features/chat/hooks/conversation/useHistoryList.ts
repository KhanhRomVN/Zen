/**
 * ------------------------------------------------------------------
 * useHistoryList
 * ------------------------------------------------------------------
 * Nạp và đồng bộ danh sách lịch sử hội thoại cho sidebar của Chat.
 *
 * Main features:
 * - Gửi getHistory và nhận historyResult từ extension
 * - Gỡ hội thoại khỏi danh sách khi nhận deleteConversationResult
 * - Nạp lại khi refreshKey đổi (ví dụ chuyển sang hội thoại khác) để
 *   hội thoại vừa tạo/cập nhật xuất hiện trong sidebar
 * - Sắp xếp mới nhất lên đầu
 *
 * Main functions:
 * - useHistoryList() : Trả về { conversations, isLoading }
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ──
import { ConversationItem } from "../../../history/types";

// ─── Helpers ────────────────────────────────────────────────────────────
const getTimestamp = (item: ConversationItem): number =>
  new Date(item.lastModified || item.timestamp || item.createdAt || 0).getTime();

// ─── Hook ───────────────────────────────────────────────────────────────
/** `onDeleted` được gọi với id hội thoại vừa bị xóa thành công. */
export function useHistoryList(
  refreshKey?: string | null,
  onDeleted?: (conversationId: string) => void,
) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const onDeletedRef = useRef(onDeleted);
  onDeletedRef.current = onDeleted;

  // Lắng nghe kết quả từ extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.command === "historyResult") {
        if (msg.history) setConversations(msg.history);
        setIsLoading(false);
      } else if (msg?.command === "deleteConversationResult" && msg.success) {
        setConversations((prev) =>
          prev.filter((c) => c.id !== msg.conversationId),
        );
        onDeletedRef.current?.(msg.conversationId);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Yêu cầu lịch sử lúc mount và mỗi khi refreshKey đổi
  useEffect(() => {
    (window as any).vscodeApi?.postMessage({
      command: "getHistory",
      requestId: `chat-hist-${Date.now()}`,
    });
  }, [refreshKey]);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => getTimestamp(b) - getTimestamp(a)),
    [conversations],
  );

  return { conversations: sorted, isLoading };
}