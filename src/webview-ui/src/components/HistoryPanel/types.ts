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
  totalRequests: number;
  totalContext: number;
  size?: number; // Size in bytes
}
