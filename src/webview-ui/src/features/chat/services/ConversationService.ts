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
  questionAnswers?: Record<string, Record<string, any>>,
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
    let existingQuestionAnswers:
      | Record<string, Record<string, any>>
      | undefined;

    const cached = ConversationCache.get(convId);
    if (cached) {
      existingToolOutputs = cached.toolOutputs;
      existingSingleLineReviewActions = cached.singleLineReviewActions;
      existingBackendConversationId = cached.backendConversationId;
      // Also get questionAnswers from cache
      if (!existingQuestionAnswers && cached.questionAnswers && Object.keys(cached.questionAnswers).length > 0) {
        existingQuestionAnswers = cached.questionAnswers;
      }
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
        // Also read questionAnswers from storage
        if (parsed.questionAnswers && Object.keys(parsed.questionAnswers).length > 0) {
          existingQuestionAnswers = parsed.questionAnswers;
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

    // Extract questionAnswers from messages to root level
    let extractedQuestionAnswers:
      | Record<string, Record<string, any>>
      | undefined;
    const messagesWithoutQA = messagesToSave.map((m) => {
      const { questionAnswers: qa, ...rest } = m;
      if (qa && Object.keys(qa).length > 0) {
        if (!extractedQuestionAnswers) extractedQuestionAnswers = {};
        extractedQuestionAnswers[m.id] = qa;
      }
      return rest;
    });

    // Merge with existing questionAnswers from cached data and parameter
    // Always try to get questionAnswers from cache first (check again in case cache was updated)
    const cachedQuestionAnswers = ConversationCache.get(convId)?.questionAnswers;
    // Also check the global store
    const storeQuestionAnswers = (ConversationCache as any).getQuestionAnswers?.(convId);
    let bestExisting = existingQuestionAnswers;
    if (cachedQuestionAnswers && Object.keys(cachedQuestionAnswers).length > 0) {
      bestExisting = cachedQuestionAnswers;
    }
    if (storeQuestionAnswers && Object.keys(storeQuestionAnswers).length > 0) {
      bestExisting = storeQuestionAnswers;
    }
    existingQuestionAnswers = bestExisting;
    
    try {
      const existingData = await storage.get(key, false);
      if (existingData && existingData.value) {
        const parsed = JSON.parse(existingData.value);
        if (
          parsed.questionAnswers &&
          Object.keys(parsed.questionAnswers).length > 0
        ) {
          existingQuestionAnswers = parsed.questionAnswers;
        }
      }
    } catch (error) {}

// Merge: parameter > extracted from messages > existing
    // ALWAYS preserve existingQuestionAnswers if no new data is provided
    const paramHasData = questionAnswers && Object.keys(questionAnswers).length > 0;
    const extractedHasData = extractedQuestionAnswers && Object.keys(extractedQuestionAnswers).length > 0;
    const existingHasData = existingQuestionAnswers && Object.keys(existingQuestionAnswers).length > 0;

    let mergedQuestionAnswers: Record<string, Record<string, any>> | undefined = existingQuestionAnswers || {};
    if (paramHasData) {
      mergedQuestionAnswers = { ...mergedQuestionAnswers, ...questionAnswers };
    }
    if (extractedHasData) {
      mergedQuestionAnswers = { ...mergedQuestionAnswers, ...extractedQuestionAnswers };
    }
    // If no data at all, set to undefined to avoid storing empty objects
    if (Object.keys(mergedQuestionAnswers).length === 0) {
      mergedQuestionAnswers = undefined;
    }
    // Use mergedQuestionAnswers or existingQuestionAnswers for storage write
    // This ensures questionAnswers are not lost when mergedQuestionAnswers is undefined
    const finalQAForStorage = mergedQuestionAnswers || existingQuestionAnswers;
    
    const data = {
      messages: messagesWithoutQA,
      conversationId: convId,
      backendConversationId:
        backendConversationId || existingBackendConversationId,
      toolOutputs: mergedToolOutputs,
      singleLineReviewActions: mergedSingleLineReviewActions,
      questionAnswers: finalQAForStorage,
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

    // ✅ DEBUG: Log before saving to storage
    console.log("[ConversationService] saveConversation - data to save:", {
      convId,
      hasQuestionAnswers: !!finalQAForStorage,
      questionAnswersKeys: finalQAForStorage ? Object.keys(finalQAForStorage) : [],
      questionAnswersData: finalQAForStorage,
      paramQuestionAnswers: questionAnswers,
      extractedQuestionAnswers,
      existingQuestionAnswers,
      mergedQuestionAnswers,
    });

    await storage.set(key, JSON.stringify(data), false);

    // Always store mergedQuestionAnswers in global store if it has data
    if (mergedQuestionAnswers && Object.keys(mergedQuestionAnswers).length > 0) {
      (ConversationCache as any).setQuestionAnswers?.(convId, mergedQuestionAnswers);
    }
    
    // Only update cache if mergedQuestionAnswers has data, or if we're explicitly clearing it
    // This prevents overwriting existing questionAnswers with undefined
    const existingCache = ConversationCache.get(convId);
    
    // Always preserve questionAnswers from global store if available
    const globalStoreQA = (ConversationCache as any).getQuestionAnswers?.(convId);
    const finalQuestionAnswers = mergedQuestionAnswers || globalStoreQA || existingCache?.questionAnswers;
    
    // Update cache with finalQuestionAnswers (preserved from global store if needed)
    const cacheData = {
      messages: messagesWithoutQA,
      conversationId: convId,
      backendConversationId:
        backendConversationId || existingBackendConversationId,
      toolOutputs: mergedToolOutputs,
      singleLineReviewActions: mergedSingleLineReviewActions,
      questionAnswers: finalQuestionAnswers,
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
