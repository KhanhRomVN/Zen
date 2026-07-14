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
  totalContext: number;
  totalTasks?: number;
  completedTasks?: number;
  uniqueTaskCount?: number;
}

export interface TabInfo {
  id: number;
  title: string;
  path: string;
  active: boolean;
}