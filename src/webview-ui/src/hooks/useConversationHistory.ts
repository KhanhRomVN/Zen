import { useState, useEffect, useCallback, useMemo } from "react";
import { extensionService } from "../services/ExtensionService";
import { ConversationItem } from "../components/HistoryPanel/types";

export const useConversationHistory = (isOpen: boolean) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState<"recent" | "oldest">(
    "recent",
  );

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

  const deleteConversation = useCallback((id: string) => {
    extensionService.postMessage({
      command: "confirmDelete",
      conversationId: id,
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    extensionService.postMessage({
      command: "confirmClearAll",
    });
  }, []);

  const filteredConversations = useMemo(() => {
    return conversations
      .filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.preview.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => {
        if (selectedSort === "recent") {
          return b.lastModified - a.lastModified;
        } else {
          return a.lastModified - b.lastModified;
        }
      });
  }, [conversations, searchQuery, selectedSort]);

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
