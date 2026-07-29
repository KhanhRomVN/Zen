/**
 * useMessagePagination
 *
 * Manages message pagination to optimize performance:
 * - Auto-hides messages after every 10 messages (20 messages total: 10 req + 10 res)
 * - Provides load more functionality
 * - Tracks visible range
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Message } from "../../types/message";

interface UseMessagePaginationProps {
  messages: Message[];
  /** Number of message pairs (req+res) to keep visible */
  messagesPerPage?: number;
}

interface UseMessagePaginationReturn {
  /** Messages currently visible */
  visibleMessages: Message[];
  /** Number of hidden messages */
  hiddenCount: number;
  /** Load next batch of messages */
  loadMore: () => void;
  /** Load all messages */
  loadAll: () => void;
  /** Whether there are hidden messages */
  hasHiddenMessages: boolean;
  /** Reset pagination (scroll to bottom, show latest) */
  reset: () => void;
}

export const useMessagePagination = ({
  messages,
  messagesPerPage = 10,
}: UseMessagePaginationProps): UseMessagePaginationReturn => {
  // Track the number of message pairs to show from the END
  const [visiblePairsFromEnd, setVisiblePairsFromEnd] =
    useState(messagesPerPage);

  // Track previous message count to detect new messages
  const prevMessageCountRef = useRef(messages.length);
  const isInitializedRef = useRef(false);

  // Initialize on first render with existing messages
  useEffect(() => {
    if (!isInitializedRef.current && messages.length > 0) {
      const totalPairs = Math.floor(messages.length / 2);
      // Calculate which "window" of 10 pairs the last pair falls into
      const currentWindow = Math.ceil(totalPairs / messagesPerPage);
      const pairsInCurrentWindow =
        totalPairs - (currentWindow - 1) * messagesPerPage;

      setVisiblePairsFromEnd(pairsInCurrentWindow);
      prevMessageCountRef.current = messages.length;
      isInitializedRef.current = true;
    }
  }, [messages.length, messagesPerPage]);

  // Reset when conversation changes (new conversation or cleared)
  useEffect(() => {
    if (messages.length === 0) {
      setVisiblePairsFromEnd(messagesPerPage);
      prevMessageCountRef.current = 0;
      isInitializedRef.current = false;
    }
  }, [messages.length === 0, messagesPerPage]);

  // Auto-hide logic: when crossing 10-pair boundary, reset to show only current window
  useEffect(() => {
    const totalPairs = Math.floor(messages.length / 2);
    const prevTotalPairs = Math.floor(prevMessageCountRef.current / 2);
    const hasNewPair = totalPairs > prevTotalPairs;

    // When we have a new message pair AND initialized
    if (hasNewPair && isInitializedRef.current) {
      const pairsInCurrentWindow =
        totalPairs % messagesPerPage || messagesPerPage;
      const shouldReset = pairsInCurrentWindow === 1; // Just crossed into new window

      if (shouldReset) {
        setVisiblePairsFromEnd(1);
      } else {
        // Still within current window, increment visible count
        setVisiblePairsFromEnd((prev) => prev + 1);
      }
    }

    // Update previous count
    prevMessageCountRef.current = messages.length;
  }, [messages.length, visiblePairsFromEnd, messagesPerPage]);

  const { visibleMessages, hiddenCount, totalPairs } = useMemo(() => {
    // Count total message pairs (each pair = 1 user + 1 assistant)
    const totalPairs = Math.floor(messages.length / 2);

    // Calculate how many to show
    const pairsToShow = Math.min(visiblePairsFromEnd, totalPairs);
    const messagesToShow = pairsToShow * 2;

    // Calculate hidden count (in message pairs)
    const hiddenPairs = Math.max(0, totalPairs - pairsToShow);

    // Slice from the end
    const startIndex = Math.max(0, messages.length - messagesToShow);
    const visible = messages.slice(startIndex);

    return {
      visibleMessages: visible,
      hiddenCount: hiddenPairs,
      totalPairs,
    };
  }, [messages, visiblePairsFromEnd]);

  const hasHiddenMessages = hiddenCount > 0;

  const loadMore = useCallback(() => {
    setVisiblePairsFromEnd((prev) =>
      Math.min(prev + messagesPerPage, totalPairs),
    );
  }, [messagesPerPage, totalPairs]);

  const loadAll = useCallback(() => {
    setVisiblePairsFromEnd(totalPairs);
  }, [totalPairs]);

  const reset = useCallback(() => {
    setVisiblePairsFromEnd(messagesPerPage);
  }, [messagesPerPage]);

  return {
    visibleMessages,
    hiddenCount,
    loadMore,
    loadAll,
    hasHiddenMessages,
    reset,
  };
};
