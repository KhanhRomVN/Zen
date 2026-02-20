export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  contextSize?: number;
  actionIds?: string[];
  uiHidden?: boolean;
  isCancelled?: boolean;
}

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

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size: number;
  status?: "added" | "modified" | "deleted" | "unchanged";
  additions?: number;
  deletions?: number;
  children?: FileNode[];
}

export interface TabInfo {
  id: number;
  title: string;
  path: string;
  active: boolean;
}
