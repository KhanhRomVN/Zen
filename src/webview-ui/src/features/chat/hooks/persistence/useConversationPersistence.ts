import { useEffect, useRef } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { saveConversation } from "../../services/ConversationService";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useConversationPersistence');

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

  log.render('useConversationPersistence', {
    renderCount: renderCountRef.current,
    conversationId: currentConversationId,
    messagesCount: messages.length,
    toolOutputsCount: Object.keys(toolOutputs).length,
    reviewActionsCount: Object.keys(singleLineReviewActions).length,
    fileStatsTotal: conversationFileStats.totalFiles
  });

  // Persist toolOutputs
  useEffect(() => {
    const effectStartTime = performance.now();
    
    if (!currentConversationId || Object.keys(toolOutputs).length === 0) {
      log.state('toolOutputs_persist_skip', { 
        reason: !currentConversationId ? 'no_conversation' : 'no_outputs' 
      });
      return;
    }

    toolOutputsSaveCountRef.current += 1;
    log.state('toolOutputs_persist_start', {
      saveCount: toolOutputsSaveCountRef.current,
      outputsCount: Object.keys(toolOutputs).length
    });

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
    
    log.perf('toolOutputs_persist_complete', effectStartTime, {
      saveCount: toolOutputsSaveCountRef.current
    });
  }, [toolOutputs, currentConversationId, currentChat, messages]);

  // Persist singleLineReviewActions
  useEffect(() => {
    const effectStartTime = performance.now();
    
    if (
      !currentConversationId ||
      Object.keys(singleLineReviewActions).length === 0
    ) {
      log.state('reviewActions_persist_skip', {
        reason: !currentConversationId ? 'no_conversation' : 'no_actions'
      });
      return;
    }

    reviewActionsSaveCountRef.current += 1;
    log.state('reviewActions_persist_start', {
      saveCount: reviewActionsSaveCountRef.current,
      actionsCount: Object.keys(singleLineReviewActions).length
    });

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
    
    log.perf('reviewActions_persist_complete', effectStartTime, {
      saveCount: reviewActionsSaveCountRef.current
    });
  }, [singleLineReviewActions, currentConversationId, currentChat, messages]);

  // Persist conversationFileStats
  useEffect(() => {
    const effectStartTime = performance.now();
    
    if (!currentConversationId || conversationFileStats.totalFiles === 0) {
      log.state('fileStats_persist_skip', {
        reason: !currentConversationId ? 'no_conversation' : 'no_files'
      });
      return;
    }

    fileStatsSaveCountRef.current += 1;
    log.state('fileStats_persist_start', {
      saveCount: fileStatsSaveCountRef.current,
      totalFiles: conversationFileStats.totalFiles,
      totalAdditions: conversationFileStats.totalAdditions,
      totalDeletions: conversationFileStats.totalDeletions
    });

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
    
    log.perf('fileStats_persist_complete', effectStartTime, {
      saveCount: fileStatsSaveCountRef.current
    });
  }, [conversationFileStats, currentConversationId, currentChat, messages]);
};
