import { extensionService } from "./ExtensionService";
import { encode } from "gpt-tokenizer";
import { Message } from "../components/ChatPanel/ChatBody/types";
import { TabInfo } from "../types";

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
      console.warn(
        "[ConversationService] vscodeApi NOT found, cannot log to workspace.",
      );
      return;
    }

    const logEntry = { ...message };
    delete logEntry.actionIds;

    logEntry.timestamp = new Date().toISOString();
    logEntry.conversationId = message.conversationId;

    extensionService.postMessage({
      command: "logChat",
      chatUuid,
      logEntry,
    });
  } catch (err) {
    console.error(`[ConversationService] Error in logChatToWorkspace:`, err);
  }
};

export const calculateTokens = (text: string): number => {
  if (!text) return 0;
  try {
    const count = encode(text).length;
    return count;
  } catch (e) {
    return Math.ceil(text.length / 4);
  }
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
  conversationId?: string, // This is the chatUuid for filename
  selectedTab?: TabInfo,
  skipTimestampUpdate?: boolean,
  title?: string,
  backendConversationId?: string,
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

    const { parseAIResponse } = require("./ResponseParser");

    const uniqueTaskNames = new Set<string>();
    for (const msg of activeMessages) {
      if (msg.role === "assistant") {
        const parsed = parseAIResponse(msg.content);
        if (parsed.taskName) {
          uniqueTaskNames.add(parsed.taskName);
        }
      }
    }
    const uniqueTaskCount = uniqueTaskNames.size;

    let existingCreatedAt: number | undefined;
    let existingLastModified: number | undefined;
    let existingTitle: string | undefined;
    let existingBackendConversationId: string | undefined;
    try {
      const existingData = await storage.get(key, false);
      if (existingData && existingData.value) {
        const parsed = JSON.parse(existingData.value);
        existingCreatedAt = parsed.metadata?.createdAt;
        existingLastModified = parsed.metadata?.lastModified;
        existingTitle = parsed.metadata?.title;
        existingBackendConversationId = parsed.backendConversationId;
      }
    } catch (error) {}

    const messagesToSave = messages.map((m) => {
      const cloned = { ...m };
      delete cloned.actionIds;
      return cloned;
    });

    const data = {
      messages: messagesToSave,
      conversationId: convId,
      backendConversationId:
        backendConversationId || existingBackendConversationId,
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
        uniqueTaskCount,
      } as ChatMetadata,
    };

    await storage.set(key, JSON.stringify(data), false);
    return convId;
  } catch (error) {
    return "";
  }
};

export const deleteConversation = async (
  conversationId?: string,
): Promise<boolean> => {
  if (!conversationId) return false;

  return new Promise((resolve) => {
    extensionService.postMessage({
      command: "deleteConversation",
      conversationId: conversationId,
    });
    resolve(true);
  });
};
