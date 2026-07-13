import { useEffect, useRef, useMemo, useState } from "react";
import { Message } from "../../types/message";
import { ConversationCache } from "../../services/ConversationCache";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useConversationCache');

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

// Debounce utility for cache updates during streaming
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to manage conversation cache updates
 * Optimized to reduce unnecessary re-renders and cache operations
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
  const renderCountRef = useRef(0);
  const effectRunCountRef = useRef(0);
  const cacheUpdateCountRef = useRef(0);
  
  renderCountRef.current += 1;
  
  log.render('useConversationCache', {
    renderCount: renderCountRef.current,
    messagesCount: messages.length,
    isStreaming,
    conversationId: currentConversationId
  });

  const messagesSignature = useMemo(() => {
    const startTime = performance.now();
    if (messages.length === 0) return "empty";
    const lastMessage = messages[messages.length - 1];
    const signature = `${messages.length}-${lastMessage.id || "unknown"}-${
      lastMessage.content?.length || 0
    }`;
    log.perf('messagesSignature_useMemo', startTime, { messagesCount: messages.length });
    return signature;
  }, [messages]);

  const hasToolOutputs = useMemo(() => {
    const result = Object.keys(toolOutputs).length > 0;
    log.cache('hasToolOutputs', true, { count: Object.keys(toolOutputs).length });
    return result;
  }, [toolOutputs]);

  const hasFileStats = useMemo(() => {
    const result = conversationFileStats.totalFiles > 0;
    log.cache('hasFileStats', true, { totalFiles: conversationFileStats.totalFiles });
    return result;
  }, [conversationFileStats.totalFiles]);

  // Track previous values
  const prevCacheDataRef = useRef<{
    messagesSignature: string;
    conversationId: string | null;
    isStreaming: boolean;
  }>({ messagesSignature: "", conversationId: null, isStreaming: false });

  // Debounce cache updates when streaming to reduce spam
  const debouncedIsStreaming = useDebounce(isStreaming, 100);

  useEffect(() => {
    effectRunCountRef.current += 1;
    const effectStartTime = performance.now();

    log.state('useConversationCache_effect', {
      effectRun: effectRunCountRef.current,
      conversationId: currentConversationId,
      messagesCount: messages.length,
      isStreaming,
      debouncedIsStreaming
    });

    // Skip if streaming or no conversation
    if (!currentConversationId || messages.length === 0) {
      log.state('cache_skip', { reason: 'no_conversation_or_messages' });
      return;
    }

    // OPTIMIZATION: Skip during streaming, only update when streaming stops
    if (isStreaming || debouncedIsStreaming) {
      log.state('cache_skip', { reason: 'streaming' });
      return;
    }

    // Update cache
    const cacheStartTime = performance.now();
    const existing = ConversationCache.get(currentConversationId);

    ConversationCache.set(currentConversationId, {
      messages,
      conversationId: currentConversationId,
      backendConversationId: existing?.backendConversationId,
      currentModel: currentModel || existing?.currentModel,
      currentAccount: currentAccount || existing?.currentAccount,
      toolOutputs: hasToolOutputs ? toolOutputs : existing?.toolOutputs,
      conversationFileStats: hasFileStats
        ? conversationFileStats
        : existing?.conversationFileStats,
    });

    cacheUpdateCountRef.current += 1;
    
    log.perf('ConversationCache_set', cacheStartTime, {
      updateCount: cacheUpdateCountRef.current,
      messagesCount: messages.length,
      hasToolOutputs,
      hasFileStats
    });

    // Update ref to track this update
    prevCacheDataRef.current = {
      messagesSignature,
      conversationId: currentConversationId,
      isStreaming,
    };

    log.perf('useConversationCache_effect_complete', effectStartTime, {
      effectRun: effectRunCountRef.current
    });
  }, [
    messagesSignature, // Use memoized signature instead of messages array
    currentConversationId,
    isStreaming,
    debouncedIsStreaming,
    hasToolOutputs,
    hasFileStats,
    currentModel,
    currentAccount,
    toolOutputs,
    conversationFileStats,
  ]);
};
