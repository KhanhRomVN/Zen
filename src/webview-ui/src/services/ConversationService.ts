import { extensionService } from "./ExtensionService";
import { encode } from "gpt-tokenizer";
import { Message } from "../components/ChatPanel/ChatBody/types";
import { TabInfo } from "../types";

const STORAGE_PREFIX = "zen-conversation";

export interface ConversationMetadata {
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
  totalContext: number;
  totalTasks?: number;
  completedTasks?: number;
  uniqueTaskCount?: number;
}

export const logToWorkspace = (conversationId: string, message: any) => {
  const vscodeApi = (window as any).vscodeApi; // Or extensionService.postMessage
  if (!vscodeApi) return;

  const logEntry = {
    ...message,
    timestamp: new Date().toISOString(),
    conversationId,
  };

  extensionService.postMessage({
    command: "logConversation",
    conversationId,
    logEntry,
  });
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
  isFirstRequest: boolean,
  conversationId?: string,
  selectedTab?: TabInfo,
  skipTimestampUpdate?: boolean,
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
    const totalContext = activeMessages.reduce(
      (sum: number, m: Message) =>
        sum + (m.usage?.total_tokens || m.contextSize || 0),
      0,
    );

    // Calculate Task Progress (Simplified extraction, reliant on parsed content existence if needed,
    // but here we might need to parse content if not already available.
    // Ideally we pass parsed info or move parsing here.
    // For now, let's keep it simple or import response parser if needed.)
    // Note: To avoid circular imports, maybe we pass specific stats?
    // Or just re-import ResponseParser here.

    // ... skipping complex parsing logic for now to avoid circular dependency with ResponseParser if it's large.
    // Assuming we can copy the logic or import it.

    const { parseAIResponse } = require("./ResponseParser");

    let totalTasks = 0;
    let completedTasks = 0;

    for (let i = activeMessages.length - 1; i >= 0; i--) {
      const msg = activeMessages[i];
      if (msg.role === "assistant") {
        const parsed = parseAIResponse(msg.content);
        let progress = parsed.taskProgress || [];
        if (progress.length === 0) {
          progress = parsed.actions.flatMap(
            (action: any) => action.taskProgress || [],
          );
        }

        if (progress.length > 0) {
          totalTasks = progress.length;
          completedTasks = progress.filter(
            (t: any) => t.status === "done",
          ).length;
          break;
        }
      }
    }

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
    try {
      const existingData = await storage.get(key, false);
      if (existingData && existingData.value) {
        const parsed = JSON.parse(existingData.value);
        existingCreatedAt = parsed.metadata?.createdAt;
        existingLastModified = parsed.metadata?.lastModified;
      }
    } catch (error) {}

    const data = {
      messages,
      isFirstRequest,
      conversationId: convId,
      metadata: {
        id: key,
        tabId,
        folderPath,
        title: messages[0]?.content.substring(0, 100) || "New Conversation",
        lastModified: skipTimestampUpdate
          ? existingLastModified || Date.now()
          : Date.now(),
        messageCount: messages.length,
        containerName: selectedTab?.containerName,
        provider: selectedTab?.provider,
        createdAt: existingCreatedAt || Date.now(),
        totalRequests,
        totalContext,
        totalTasks,
        completedTasks,
        uniqueTaskCount,
      } as ConversationMetadata,
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
