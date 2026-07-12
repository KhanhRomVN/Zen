import { useEffect, useRef } from "react";
import { Message } from "../../types/message";
import { ConversationCache } from "../../services/ConversationCache";

interface UseConversationCacheProps {
  currentConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  currentModel: any;
  currentAccount: any;
  toolOutputs: any;
  conversationFileStats: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  };
}

/**
 * Hook to manage conversation cache updates
 */
export const useConversationCache = ({
  currentConversationId,
  messages,
  isStreaming,
  currentModel,
  currentAccount,
  toolOutputs,
  conversationFileStats,
}: UseConversationCacheProps) => {
  // PERF: Use refs to track previous values to avoid triggering on every render
  const prevCacheDataRef = useRef<{
    messagesLength: number;
    conversationId: string | null;
    isStreaming: boolean;
  }>({ messagesLength: 0, conversationId: null, isStreaming: false });

  useEffect(() => {
    // Skip if streaming or no conversation
    if (!currentConversationId || messages.length === 0 || isStreaming) {
      return;
    }

    // Skip if nothing changed since last cache update
    const prev = prevCacheDataRef.current;
    if (
      prev.messagesLength === messages.length &&
      prev.conversationId === currentConversationId &&
      prev.isStreaming === isStreaming
    ) {
      return; // Nothing changed, skip cache update
    }

    // Update cache
    const existing = ConversationCache.get(currentConversationId);
    ConversationCache.set(currentConversationId, {
      messages,
      conversationId: currentConversationId,
      backendConversationId: existing?.backendConversationId,
      currentModel: currentModel || existing?.currentModel,
      currentAccount: currentAccount || existing?.currentAccount,
      toolOutputs:
        Object.keys(toolOutputs).length > 0
          ? toolOutputs
          : existing?.toolOutputs,
      conversationFileStats:
        conversationFileStats.totalFiles > 0
          ? conversationFileStats
          : existing?.conversationFileStats,
    });

    // Update ref to track this update
    prevCacheDataRef.current = {
      messagesLength: messages.length,
      conversationId: currentConversationId,
      isStreaming,
    };
  }, [
    messages,
    currentConversationId,
    currentModel,
    currentAccount,
    toolOutputs,
    conversationFileStats,
    isStreaming,
  ]);
};
