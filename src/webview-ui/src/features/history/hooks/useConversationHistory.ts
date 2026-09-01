/**
 * ------------------------------------------------------------------
 * useConversationHistory
 * ------------------------------------------------------------------
 * Custom hook quản lý lịch sử hội thoại — fetch, tìm kiếm, sắp xếp và xóa.

 * Main features:
 * - Load danh sách hội thoại từ extension
 * - Tìm kiếm theo tiêu đề/preview, sắp xếp theo thời gian
 * - Lắng nghe message event để cập nhật UI khi xóa
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import { useState, useEffect, useCallback, useMemo } from "react";

// ── Services ──
import { extensionService } from "@/services/ExtensionService";

// ── Types ──
import { ConversationItem } from "../types";

// ─── Hook ───────────────────────────────────────────────────────────────
export const useConversationHistory = (isOpen: boolean) => {
  // ── State ──
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState<"recent" | "oldest">(
    "recent",
  );

  // ── Derived ──
  const filteredConversations = useMemo(() => {
    return conversations
      .filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.preview.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => {
        const timeA = new Date(
          a.lastModified || a.timestamp || a.createdAt || 0,
        ).getTime();
        const timeB = new Date(
          b.lastModified || b.timestamp || b.createdAt || 0,
        ).getTime();
        if (selectedSort === "recent") {
          return timeB - timeA;
        } else {
          return timeA - timeB;
        }
      });
  }, [conversations, searchQuery, selectedSort]);

  // ── Callbacks ──
  const loadHistory = useCallback(() => {
    setIsLoading(true);
    const requestId = `hist-${Date.now()}`;
    extensionService.postMessage({
      command: "getHistory",
      requestId: requestId,
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    extensionService.postMessage({
      command: "deleteConversation",
      conversationId: id,
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    extensionService.postMessage({
      command: "deleteAllConversations",
    });
  }, []);

  // ── Effects ──
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "historyResult") {
        if (message.history) {
          setConversations(message.history);
        }
        setIsLoading(false);
      } else if (
        message.command === "deleteConversationResult" &&
        message.success
      ) {
        setConversations((prev) =>
          prev.filter((c) => c.id !== message.conversationId),
        );
      } else if (
        message.command === "deleteAllConversationsResult" &&
        message.success
      ) {
        setConversations([]);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return {
    conversations: filteredConversations,
    totalCount: conversations.length,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedSort,
    setSelectedSort,
    deleteConversation,
    clearAllHistory,
    refreshHistory: loadHistory,
  };
};