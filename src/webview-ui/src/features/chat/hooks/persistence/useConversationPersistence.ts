import { useEffect, useRef } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { saveConversation } from "../../services/ConversationService";

interface UseConversationPersistenceProps {
  currentConversationId: string | null;
  currentChat: ChatSession | null;
  messages: Message[];
  toolOutputs: any;
  singleLineReviewActions: any;
  conversationFileStats: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  };
}

/**
 * Hook to persist conversation data to storage
 */
export const useConversationPersistence = ({
  currentConversationId,
  currentChat,
  messages,
  toolOutputs,
  singleLineReviewActions,
  conversationFileStats,
}: UseConversationPersistenceProps) => {
  const renderCountRef = useRef(0);
  const toolOutputsSaveCountRef = useRef(0);
  const reviewActionsSaveCountRef = useRef(0);
  const fileStatsSaveCountRef = useRef(0);

  renderCountRef.current += 1;

  // Persist toolOutputs
  useEffect(() => {
    const effectStartTime = performance.now();

    if (!currentConversationId || Object.keys(toolOutputs).length === 0) {
      return;
    }

    toolOutputsSaveCountRef.current += 1;

    const sessionId = currentChat?.sessionId || -1;
    const folderPath = currentChat?.folderPath || null;
    saveConversation(
      sessionId,
      folderPath,
      messages,
      currentConversationId,
      currentChat || undefined,
      true,
      undefined,
      undefined,
      toolOutputs,
    );
  }, [toolOutputs, currentConversationId, currentChat, messages]);

  // Persist singleLineReviewActions
  useEffect(() => {
    const effectStartTime = performance.now();

    if (
      !currentConversationId ||
      Object.keys(singleLineReviewActions).length === 0
    ) {
      return;
    }

    reviewActionsSaveCountRef.current += 1;

    const sessionId = currentChat?.sessionId || -1;
    const folderPath = currentChat?.folderPath || null;
    saveConversation(
      sessionId,
      folderPath,
      messages,
      currentConversationId,
      currentChat || undefined,
      true,
      undefined,
      undefined,
      undefined,
      singleLineReviewActions,
    );
  }, [singleLineReviewActions, currentConversationId, currentChat, messages]);

  // Persist conversationFileStats
  useEffect(() => {
    const effectStartTime = performance.now();

    if (!currentConversationId || conversationFileStats.totalFiles === 0) {
      return;
    }

    fileStatsSaveCountRef.current += 1;

    const sessionId = currentChat?.sessionId || -1;
    const folderPath = currentChat?.folderPath || null;
    saveConversation(
      sessionId,
      folderPath,
      messages,
      currentConversationId,
      currentChat || undefined,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      conversationFileStats,
    );
  }, [conversationFileStats, currentConversationId, currentChat, messages]);
};
