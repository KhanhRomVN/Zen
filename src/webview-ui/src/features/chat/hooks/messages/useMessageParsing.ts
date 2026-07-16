import { useMemo, useRef } from "react";
import { Message } from "../../types/message";
import { parseAIResponse } from "../../services/ResponseParser";

/**
 * Hook to parse messages with advanced caching for performance optimization
 */
export const useMessageParsing = (
  messages: Message[],
  isStreaming: boolean,
) => {
  // Parse cache — reuse results across renders, avoiding redundant re-parses
  // when only unrelated state changes (same messages array, same content).
  const parseCacheRef = useRef<Map<string, ReturnType<typeof parseAIResponse>>>(
    new Map(),
  );

  // Cache parsed message objects to maintain reference stability
  // Map from cache key (id:contentLength:clicked:rejected) to the full parsed message object
  const parsedMessageObjectCacheRef = useRef<Map<string, any>>(new Map());
  const lastStreamingParseRef = useRef<{
    messageId: string;
    contentLength: number;
    parsed: ReturnType<typeof parseAIResponse>;
  } | null>(null);

  //   Track last parsed messages to enable incremental updates
  const lastParsedLengthRef = useRef(0);
  const lastParsedResultRef = useRef<any[]>([]);
  const lastMessagesRef = useRef<Message[]>([]); // Track previous messages array for comparison

  const parsedMessages = useMemo(() => {
    const _startTime = performance.now();
    const cache = parseCacheRef.current;
    const lastStreaming = lastStreamingParseRef.current;

    // PERF OPTIMIZATION: Incremental parsing with stable references
    // CRITICAL FIX: Check if messages array only GREW (new messages added)
    // We DON'T compare content because the last message might be streaming (content changes)
    // We only check if existing message IDs match → same messages, just potentially updated content
    const messagesOnlyGrew =
      messages.length >= lastParsedLengthRef.current &&
      lastParsedResultRef.current.length > 0;

    // For non-streaming messages, check if they're identical to previous render
    const existingMessagesUnchanged =
      messagesOnlyGrew &&
      messages.slice(0, lastParsedLengthRef.current).every(
        (msg, i) => msg === lastMessagesRef.current[i], // Same object reference = unchanged
      );

    let result: any[];

    if (existingMessagesUnchanged) {
      //   Reuse ALL previous parsed message objects (stable references!)
      const reusedMessages = lastParsedResultRef.current.slice(
        0,
        lastParsedLengthRef.current,
      );

      // Only parse new messages (or re-parse if last message is streaming)
      const newMessages = messages.slice(lastParsedLengthRef.current);
      const newParsed = newMessages.map((msg: Message, index: number) => {
        const globalIndex = lastParsedLengthRef.current + index;
        const isLastMessage = globalIndex === messages.length - 1;
        const isAssistantStreaming =
          isLastMessage && msg.role === "assistant" && isStreaming;

        return parseMessageWithCache(
          msg,
          isAssistantStreaming,
          cache,
          lastStreaming,
        );
      });

      result = [...reusedMessages, ...newParsed];
    } else if (messagesOnlyGrew && !existingMessagesUnchanged) {
      // Messages grew but some existing messages changed (e.g., clickedActions updated)
      // Re-parse ALL but try to use object cache for unchanged ones
      result = messages.map((msg: Message, index: number) => {
        const isLastMessage = index === messages.length - 1;
        const isAssistantStreaming =
          isLastMessage && msg.role === "assistant" && isStreaming;

        return parseMessageWithCache(
          msg,
          isAssistantStreaming,
          cache,
          lastStreaming,
        );
      });
    } else {
      // Full re-parse (messages array shrank or completely different)
      result = messages.map((msg: Message, index: number) => {
        const isLastMessage = index === messages.length - 1;
        const isAssistantStreaming =
          isLastMessage && msg.role === "assistant" && isStreaming;

        return parseMessageWithCache(
          msg,
          isAssistantStreaming,
          cache,
          lastStreaming,
        );
      });
    }

    // Clear streaming ref when no longer streaming
    if (!isStreaming) {
      lastStreamingParseRef.current = null;
    }

    // Cache result and messages for next incremental update
    lastParsedLengthRef.current = messages.length;
    lastParsedResultRef.current = result;
    lastMessagesRef.current = messages; // Store current messages array for next comparison

    return result;
  }, [messages, isStreaming]);

  // Helper function to parse a single message with caching
  function parseMessageWithCache(
    msg: Message,
    isAssistantStreaming: boolean,
    cache: Map<string, ReturnType<typeof parseAIResponse>>,
    lastStreaming: typeof lastStreamingParseRef.current,
  ) {
    // STREAMING FIX: Always parse fresh for streaming messages to ensure
    // letter-by-letter animation works. No cache optimization during streaming.
    if (!isAssistantStreaming && cache.has(msg.content)) {
      // Only use cache for non-streaming messages
      const parsed = cache.get(msg.content)!;
      const clickedKey = (msg.clickedActions || []).join(",");
      const rejectedKey = (msg.rejectedActions || []).join(",");
      const cacheKey = `${msg.id}:${msg.content.length}:${clickedKey}:${rejectedKey}`;

      const objectCache = parsedMessageObjectCacheRef.current;
      if (objectCache.has(cacheKey)) {
        return objectCache.get(cacheKey)!;
      }

      const parsedMsg = { ...msg, parsed };
      if (objectCache.size > 100) {
        const keys = Array.from(objectCache.keys());
        keys.slice(0, 50).forEach((k) => objectCache.delete(k));
      }
      objectCache.set(cacheKey, parsedMsg);
      return parsedMsg;
    }

    // Parse fresh for streaming or cache miss
    const parseStart = performance.now();
    const parsed = parseAIResponse(msg.content);

    // Cache the parse result (but always create new object for streaming)
    if (!isAssistantStreaming) {
      cache.set(msg.content, parsed);
    }

    // Update streaming parse ref for next render
    if (isAssistantStreaming) {
      lastStreamingParseRef.current = {
        messageId: msg.id,
        contentLength: msg.content.length,
        parsed,
      };
    }

    // Always create new object for streaming messages (never reuse from object cache)
    return { ...msg, parsed };
  }

  return parsedMessages;
};
