export type Role = "user" | "assistant" | "system-checkpoint" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isFirstRequest?: boolean;
  isToolRequest?: boolean;
  systemPrompt?: string;
  contextSize?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  checkpointData?: CheckpointData;
  actionIds?: string[];
  uiHidden?: boolean;
  isCancelled?: boolean;
}

export interface CheckpointData {
  id: string;
  totalFiles: number;
  totalSize: number;
  storageSize?: number;
  timestamp: number;
  files: any;
  stats?: {
    added: number;
    modified: number;
    deleted: number;
  };
  changes?: {
    [path: string]: {
      status: "added" | "modified" | "deleted";
      additions: number;
      deletions: number;
    };
  };
}

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
