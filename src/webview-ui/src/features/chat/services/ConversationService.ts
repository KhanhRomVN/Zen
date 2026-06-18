import { extensionService } from "./ExtensionService";
import { Message } from "../types";
import { ConversationCache } from "./ConversationCache";

export interface TabInfo {
  tabId: number;
  containerName: string;
  title: string;
  url?: string;
  status: "free" | "busy" | "sleep";
  canAccept: boolean;
  requestCount: number;
  folderPath?: string | null;
  conversationId?: string | null;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok";
  cookieStoreId?: string;
}

const STORAGE_PREFIX = "zen-chat";

export interface ChatMetadata {
  id: string;
  tabId: number;
  folderPath: string | null;
  title: string;
  lastModified: number;
  messageCount: number;
  containerName?: string;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok";

  createdAt: number;
  totalRequests: number;
  totalTokenUsage: number;
  uniqueTaskCount?: number;
}

export const logChatToWorkspace = (chatUuid: string, message: any) => {
  try {
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) {
      return;
    }

    const logEntry = { ...message };
    // Retain actionIds for tool execution tracking on session restore
    logEntry.timestamp = new Date().toISOString();
    logEntry.conversationId = message.conversationId;

    extensionService.postMessage({
      command: "logChat",
      chatUuid,
      logEntry,
    });
  } catch (err) {}
};

export const calculateTokens = (text: string): number => {
  if (!text) return 0;
  // Fast approximation: ~4 chars per token (avoids heavy gpt-tokenizer encode)
  return Math.ceil(text.length / 4);
};

export const getConversationKey = (
  tabId: number,
  folderPath: string | null,
  conversationId?: string,
): string => {
  if (conversationId && conversationId.startsWith(STORAGE_PREFIX)) {
    return conversationId;
  }

  const safeFolderPath = folderPath || "global";
  const convId = conversationId || Date.now().toString();
  const fullKey = `${STORAGE_PREFIX}:${tabId}:${safeFolderPath}:${convId}`;
  return fullKey;
};

export const saveConversation = async (
  tabId: number,
  folderPath: string | null,
  messages: Message[],
  conversationId?: string,
  selectedTab?: TabInfo,
  skipTimestampUpdate?: boolean,
  title?: string,
  backendConversationId?: string,
  toolOutputs?: Record<
    string,
    { output: string; isError: boolean; terminalId?: string }
  >,
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >,
): Promise<string> => {
  try {
    const storage = (window as any).storage;
    if (!storage) return "";

    const convId = conversationId || Date.now().toString();
    const key = getConversationKey(tabId, folderPath, convId);

    // Calculate stats
    const activeMessages = messages.filter((m) => !m.isCancelled);
    const totalRequests = activeMessages.filter(
      (m: Message) => m.role === "user",
    ).length;
    const totalTokenUsage = activeMessages.reduce(
      (sum: number, m: Message) => sum + (m.token_usage || 0),
      0,
    );

    let existingCreatedAt: number | undefined;
    let existingLastModified: number | undefined;
    let existingTitle: string | undefined;
    let existingBackendConversationId: string | undefined;
    let existingToolOutputs:
      | Record<
          string,
          { output: string; isError: boolean; terminalId?: string }
        >
      | undefined;
    let existingSingleLineReviewActions:
      | Record<string, { action: any; actionId: string; messageId: string }>
      | undefined;

    // Always check in-memory cache first — it's sync and avoids race conditions
    // when multiple saveConversation calls happen concurrently (e.g. toolOutputs persist
    // fires at the same time as the post-stream final save).
    const cached = ConversationCache.get(convId);
    if (cached) {
      existingToolOutputs = cached.toolOutputs;
      existingSingleLineReviewActions = cached.singleLineReviewActions;
      existingBackendConversationId = cached.backendConversationId;
    }

    try {
      const existingData = await storage.get(key, false);
      if (existingData && existingData.value) {
        const parsed = JSON.parse(existingData.value);
        existingCreatedAt = parsed.metadata?.createdAt;
        existingLastModified = parsed.metadata?.lastModified;
        existingTitle = parsed.metadata?.title;
        if (!existingBackendConversationId) {
          existingBackendConversationId = parsed.backendConversationId;
        }
        // Only use disk toolOutputs if cache had nothing — cache is more up-to-date
        if (
          !existingToolOutputs &&
          parsed.toolOutputs &&
          Object.keys(parsed.toolOutputs).length > 0
        ) {
          existingToolOutputs = parsed.toolOutputs;
        }
        if (
          !existingSingleLineReviewActions &&
          parsed.singleLineReviewActions &&
          Object.keys(parsed.singleLineReviewActions).length > 0
        ) {
          existingSingleLineReviewActions = parsed.singleLineReviewActions;
        }
      }
    } catch (error) {}

    const messagesToSave = messages.map((m) => {
      const cloned = { ...m };
      // Retain actionIds for tool execution tracking on session restore
      return cloned;
    });

    // Merge incoming toolOutputs with existing ones so error outputs are never dropped.
    // If caller passes no toolOutputs (undefined), preserve whatever is already on disk.
    const mergedToolOutputs =
      toolOutputs && Object.keys(toolOutputs).length > 0
        ? { ...(existingToolOutputs || {}), ...toolOutputs }
        : existingToolOutputs || undefined;

    // Merge incoming singleLineReviewActions with existing ones
    const mergedSingleLineReviewActions =
      singleLineReviewActions && Object.keys(singleLineReviewActions).length > 0
        ? {
            ...(existingSingleLineReviewActions || {}),
            ...singleLineReviewActions,
          }
        : existingSingleLineReviewActions || undefined;

    const data = {
      messages: messagesToSave,
      conversationId: convId,
      backendConversationId:
        backendConversationId || existingBackendConversationId,
      toolOutputs: mergedToolOutputs,
      singleLineReviewActions: mergedSingleLineReviewActions,
      metadata: {
        id: key,
        tabId,
        folderPath,
        title:
          title ||
          existingTitle ||
          messages[0]?.content.substring(0, 100) ||
          "New Conversation",
        lastModified: skipTimestampUpdate
          ? existingLastModified || Date.now()
          : Date.now(),
        messageCount: messages.length,
        containerName: selectedTab?.containerName,
        provider: selectedTab?.provider,
        createdAt: existingCreatedAt || Date.now(),
        totalRequests,
        totalTokenUsage,
      } as ChatMetadata,
    };

    await storage.set(key, JSON.stringify(data), false);
    const errorOutputKeys = mergedToolOutputs
      ? Object.entries(mergedToolOutputs)
          .filter(([, v]) => v.isError)
          .map(([k]) => k)
      : [];

    // Sync to in-memory cache — include toolOutputs & singleLineReviewActions so cache-hits also have this data
    ConversationCache.set(convId, {
      messages: messagesToSave,
      conversationId: convId,
      backendConversationId:
        backendConversationId || existingBackendConversationId,
      toolOutputs: mergedToolOutputs,
      singleLineReviewActions: mergedSingleLineReviewActions,
    });

    return convId;
  } catch (error) {
    return "";
  }
};

export const deleteConversation = async (
  conversationId?: string,
): Promise<boolean> => {
  if (!conversationId) return false;

  // Sync delete to in-memory cache
  ConversationCache.delete(conversationId);

  return new Promise((resolve) => {
    extensionService.postMessage({
      command: "deleteConversation",
      conversationId: conversationId,
    });
    resolve(true);
  });
};
