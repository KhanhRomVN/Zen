export interface ConversationItem {
  id: string;
  tabId: number;
  folderPath: string | null;
  title: string;
  lastModified: number;
  messageCount: number;
  preview: string;
  containerName?: string;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok" | "claude";
  createdAt: number;
  timestamp?: number;
  totalRequests: number;
  totalTokenUsage: number;
  size?: number; // Size in bytes
  totalTasks?: number;
  completedTasks?: number;
  uniqueTaskCount?: number;
}
