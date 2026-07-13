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
    const startTime = performance.now();
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
    //   During streaming, if the last message is the same one and content
    // only grew by a small amount (no new closing tags), reuse the cached
    // parsed result to avoid re-running the full parser on every chunk.
    if (
      isAssistantStreaming &&
      lastStreaming &&
      lastStreaming.messageId === msg.id &&
      msg.content.length > lastStreaming.contentLength
    ) {
      const growth = msg.content.length - lastStreaming.contentLength;
      // Check if new content contains a closing tag (structural change)
      const newContent = msg.content.slice(lastStreaming.contentLength);
      const hasClosingTag = /<\/[a-zA-Z_][a-zA-Z0-9_]*>/i.test(newContent);

      if (!hasClosingTag && growth < 500) {
        // Small text-only append — reuse previous parse result.
        // The UI will still show new text because content comes from msg.content,
        // not from parsed result.
        lastStreaming.contentLength = msg.content.length;
        return { ...msg, parsed: lastStreaming.parsed };
      }
    }

    // Normal path: use cache or parse fresh
    if (!cache.has(msg.content)) {
      const parseStart = performance.now();
      const parsed = parseAIResponse(msg.content);
      cache.set(msg.content, parsed);

      // Update streaming parse ref for next render
      if (isAssistantStreaming) {
        lastStreamingParseRef.current = {
          messageId: msg.id,
          contentLength: msg.content.length,
          parsed,
        };
      }
    } else if (isAssistantStreaming) {
      // Cache hit during streaming — still update the ref
      lastStreamingParseRef.current = {
        messageId: msg.id,
        contentLength: msg.content.length,
        parsed: cache.get(msg.content)!,
      };
    }

    // PERF FIX: Create a cache key that identifies this message's state
    // Key includes: id + content + clickedActions + rejectedActions to detect changes
    const clickedKey = (msg.clickedActions || []).join(",");
    const rejectedKey = (msg.rejectedActions || []).join(",");
    const cacheKey = `${msg.id}:${msg.content.length}:${clickedKey}:${rejectedKey}`;

    // Check object cache - if we've created this exact parsed message before, reuse it
    const objectCache = parsedMessageObjectCacheRef.current;
    if (objectCache.has(cacheKey)) {
      return objectCache.get(cacheKey)!;
    }

    // Create new parsed message object
    const parsedMsg = { ...msg, parsed: cache.get(msg.content)! };

    // Store in object cache (limit size to prevent memory leak)
    if (objectCache.size > 100) {
      // Clear old entries when cache grows too large
      const keys = Array.from(objectCache.keys());
      keys.slice(0, 50).forEach((k) => objectCache.delete(k));
    }
    objectCache.set(cacheKey, parsedMsg);

    return parsedMsg;
  }

  return parsedMessages;
};
