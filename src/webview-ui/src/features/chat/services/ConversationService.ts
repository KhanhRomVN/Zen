import { extensionService } from "../../../services/ExtensionService";
import { Message } from "../types/message";
import { ConversationCache } from "./ConversationCache";
import { ChatSession } from "../types/chat";

const STORAGE_PREFIX = "zen-chat";

export interface ChatMetadata {
  id: string;
  sessionId: number;
  folderPath: string | null;
  title: string;
  lastModified: number;
  messageCount: number;
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
  return Math.ceil(text.length / 4);
};

export const getConversationKey = (
  sessionId: number,
  folderPath: string | null,
  conversationId?: string,
): string => {
  if (conversationId && conversationId.startsWith(STORAGE_PREFIX)) {
    return conversationId;
  }

  const safeFolderPath = folderPath || "global";
  const convId = conversationId || Date.now().toString();
  const fullKey = `${STORAGE_PREFIX}:${sessionId}:${safeFolderPath}:${convId}`;
  return fullKey;
};

export const saveConversation = async (
  sessionId: number,
  folderPath: string | null,
  messages: Message[],
  conversationId?: string,
  currentChat?: ChatSession,
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
  conversationFileStats?: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  },
): Promise<string> => {
  try {
    const storage = (window as any).storage;
    if (!storage) return "";

    const convId = conversationId || Date.now().toString();
    const key = getConversationKey(sessionId, folderPath, convId);

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

    const messagesToSave = messages.map((m) => ({ ...m }));

    const mergedToolOutputs =
      toolOutputs && Object.keys(toolOutputs).length > 0
        ? { ...(existingToolOutputs || {}), ...toolOutputs }
        : existingToolOutputs || undefined;

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
      conversationFileStats: conversationFileStats,
      metadata: {
        id: key,
        sessionId,
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
        createdAt: existingCreatedAt || Date.now(),
        totalRequests,
        totalTokenUsage,
      } as ChatMetadata,
    };

    await storage.set(key, JSON.stringify(data), false);

    // Sync conversation state to file JSON (for backend restore)
    extensionService.postMessage({
      command: "saveConversationState",
      conversationId: convId,
      messages: messagesToSave,
      backendConversationId:
        backendConversationId || existingBackendConversationId,
      toolOutputs: mergedToolOutputs,
      singleLineReviewActions: mergedSingleLineReviewActions,
      conversationFileStats: conversationFileStats,
      metadata: data.metadata,
    });

    // Update cache
    const cacheData = {
      messages: messagesToSave,
      conversationId: convId,
      backendConversationId:
        backendConversationId || existingBackendConversationId,
      toolOutputs: mergedToolOutputs,
      singleLineReviewActions: mergedSingleLineReviewActions,
      conversationFileStats: conversationFileStats,
    };
    ConversationCache.set(convId, cacheData);
    return convId;
  } catch (error) {
    return "";
  }
};

export const deleteConversation = async (
  conversationId?: string,
): Promise<boolean> => {
  if (!conversationId) return false;

  ConversationCache.delete(conversationId);

  return new Promise((resolve) => {
    extensionService.postMessage({
      command: "deleteConversation",
      conversationId: conversationId,
    });
    resolve(true);
  });
};
