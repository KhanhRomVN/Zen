import { Message } from "../types/message";
import { calculateTokens, logChatToWorkspace } from "./ConversationService";

export interface StreamConfig {
  apiUrl: string;
  model: any;
  account: any;
  messages: Array<{ role: string; content: string }>;
  conversationId?: string;
  parentMessageId?: string;
  refFileIds?: string[];
  abortSignal: AbortSignal;
  isPerformanceMode?: boolean; // Performance mode: disable streaming parse
}

export interface StreamCallbacks {
  onMetadata?: (meta: any) => void;
  onContent?: (content: string) => void;
  onThinking?: (thinking: string) => void;
  onUsage?: (usage: any) => void;
  onContinuing?: (isContinuing: boolean) => void;
  onIncompleteToolDetected?: (
    hasPartial: boolean,
    toolType: string | null,
  ) => void;
  onRawContent?: (content: string) => void; // For performance mode: raw content without parsing
}

export class StreamingService {
  static async streamChat(
    config: StreamConfig,
    callbacks: StreamCallbacks,
  ): Promise<{ message: Message; backendConversationId: string }> {
    const body = {
      modelId: config.model?.id,
      providerId: config.model?.providerId,
      accountId: config.account?.id,
      messages: config.messages,
      stream: true,
      ...(config.conversationId
        ? { conversationId: config.conversationId }
        : {}),
      ...(config.parentMessageId
        ? { parent_message_id: config.parentMessageId }
        : {}),
      is_thinking: localStorage.getItem("zen-thinking-enabled") === "true",
      is_search: localStorage.getItem("zen-search-enabled") === "true",
      thinking: localStorage.getItem("zen-thinking-enabled") === "true",
      search: localStorage.getItem("zen-search-enabled") === "true",
      ...(config.refFileIds && config.refFileIds.length > 0
        ? { ref_file_ids: config.refFileIds }
        : {}),
    };

    const response = await fetch(`${config.apiUrl}/v1/chat/accounts/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: config.abortSignal,
    });

    if (!response.ok) {
      let errorDetail = `API Error: ${response.status}`;
      try {
        const errBody = await response.json();
        const raw = errBody.error || errBody.message;
        const msg = typeof raw === "string" ? raw : JSON.stringify(raw);
        errorDetail = msg || errorDetail;
        if (errBody.error_code)
          errorDetail = `[${errBody.error_code}] ${errorDetail}`;
      } catch {}
      throw new Error(errorDetail);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let assistantMessage: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    let backendConversationId = "";
    let done = false;
    let buffer = "";
    let firstChunkReceived = false;

    // Performance mode: stream content but don't parse until complete
    const isPerformanceMode = config.isPerformanceMode || false;

    // Batching - Optimized for smooth letter-by-letter streaming
    let updateBatch = { content: "", thinking: "" };
    let lastFlushTime = Date.now();
    const FLUSH_INTERVAL_MS = 8; // ~120fps for smooth streaming without overwhelming React

    // First-chunk timeout
    const FIRST_CHUNK_TIMEOUT_MS = 305_000;
    const firstChunkTimer = setTimeout(() => {
      if (!firstChunkReceived) {
        config.abortSignal.dispatchEvent(new Event("abort"));
      }
    }, FIRST_CHUNK_TIMEOUT_MS);

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          clearTimeout(firstChunkTimer);
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            // Handle UUID conversation_id
            if (
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                dataStr,
              )
            ) {
              backendConversationId = dataStr;
              continue;
            }

            try {
              const data = JSON.parse(dataStr);

              // Handle stream error
              if (data.error) {
                const code = data.error_code ? `[${data.error_code}] ` : "";
                const err = new Error(`${code}${data.error}`);
                (err as any).isServerError = true;
                throw err;
              }

              // Conversation ID
              const recvConvId =
                data.meta?.conversation_id || data.conversation_id;
              if (recvConvId) {
                backendConversationId = recvConvId;
                assistantMessage.conversationId = recvConvId;
              }

              // Metadata
              const metaObj = data.meta || data.metadata;
              if (metaObj) {
                if (metaObj.providerId)
                  assistantMessage.providerId = metaObj.providerId;
                if (metaObj.modelId) assistantMessage.modelId = metaObj.modelId;
                if (metaObj.accountId)
                  assistantMessage.accountId = metaObj.accountId;
                if (metaObj.websiteUrl)
                  assistantMessage.websiteUrl = metaObj.websiteUrl;
                if (metaObj.email) assistantMessage.email = metaObj.email;
                if (metaObj.response_message_id)
                  assistantMessage.response_message_id =
                    metaObj.response_message_id;

                callbacks.onMetadata?.(metaObj);

                if (metaObj.continuing !== undefined) {
                  callbacks.onContinuing?.(metaObj.continuing);
                }

                if (metaObj.incomplete_has_partial_tool !== undefined) {
                  callbacks.onIncompleteToolDetected?.(
                    metaObj.incomplete_has_partial_tool,
                    metaObj.incomplete_partial_tool_type ?? null,
                  );
                }

                if (metaObj.continuation_complete === true) {
                  callbacks.onIncompleteToolDetected?.(false, null);
                }
              }

              // Usage
              if (data.usage) {
                assistantMessage.usage = data.usage;
                assistantMessage.token_usage = data.usage.total_tokens;
                callbacks.onUsage?.(data.usage);
              }

              // Content
              if (data.content) {
                assistantMessage.content += data.content;
                updateBatch.content += data.content;
              }

              if (data.thinking) {
                assistantMessage.thinking =
                  (assistantMessage.thinking || "") + data.thinking;
                updateBatch.thinking += data.thinking;
              }

              // Flush batch
              const now = Date.now();
              const shouldFlush =
                now - lastFlushTime >= FLUSH_INTERVAL_MS || data.usage;

              if (
                shouldFlush &&
                (updateBatch.content || updateBatch.thinking || data.usage)
              ) {
                // In performance mode, send to onRawContent for ThinkingBlock display
                if (isPerformanceMode) {
                  if (updateBatch.content)
                    callbacks.onRawContent?.(updateBatch.content);
                } else {
                  // Normal mode: parse as we stream
                  if (updateBatch.content)
                    callbacks.onContent?.(updateBatch.content);
                }

                if (updateBatch.thinking)
                  callbacks.onThinking?.(updateBatch.thinking);
                updateBatch = { content: "", thinking: "" };
                lastFlushTime = now;
              }
            } catch (e) {
              if (e instanceof Error && (e as any).isServerError) throw e;
            }
          }
        }
      }
    }

    clearTimeout(firstChunkTimer);

    // Flush remaining batch - in performance mode, this is where we parse everything once
    if (isPerformanceMode) {
      // Performance mode: send all accumulated content for parsing NOW
      if (assistantMessage.content) {
        callbacks.onContent?.(assistantMessage.content);
      }
    } else {
      // Normal mode: flush any remaining batched content
      if (updateBatch.content) callbacks.onContent?.(updateBatch.content);
    }

    if (updateBatch.thinking) callbacks.onThinking?.(updateBatch.thinking);

    // Process remaining buffer
    const remainingLines = buffer
      .split("\n")
      .filter((l) => l.trim().startsWith("data: "));
    for (const line of remainingLines) {
      const dataStr = line.slice(6).trim();
      if (dataStr === "[DONE]") continue;

      try {
        const data = JSON.parse(dataStr);
        const metaObj = data.meta || data.metadata;

        if (metaObj) {
          if (metaObj.providerId)
            assistantMessage.providerId = metaObj.providerId;
          if (metaObj.modelId) assistantMessage.modelId = metaObj.modelId;
          if (metaObj.accountId) assistantMessage.accountId = metaObj.accountId;
          if (metaObj.websiteUrl)
            assistantMessage.websiteUrl = metaObj.websiteUrl;
          if (metaObj.email) assistantMessage.email = metaObj.email;
          callbacks.onMetadata?.(metaObj);
        }

        if (data.usage) {
          assistantMessage.usage = data.usage;
          assistantMessage.token_usage = data.usage.total_tokens;
        }

        if (data.content) {
          assistantMessage.content += data.content;
        }

        if (data.thinking) {
          assistantMessage.thinking =
            (assistantMessage.thinking || "") + data.thinking;
        }
      } catch (e) {}
    }

    // Fallback token calculation
    if (!assistantMessage.token_usage && assistantMessage.content) {
      assistantMessage.token_usage = calculateTokens(assistantMessage.content);
    }

    assistantMessage.rawResponse = assistantMessage.content;

    return { message: assistantMessage, backendConversationId };
  }
}
