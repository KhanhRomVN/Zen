export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // Base64 or text content
}

export interface WorkspaceItem {
  path: string;
  type: "file" | "folder";
  lastModified?: number;
  size?: number;
}

export interface AttachedItem {
  id: string;
  path: string;
  type: "file" | "folder" | "external";
}

export interface ExternalFile {
  id: string;
  name: string;
  path: string; // Full absolute path
  content: string;
  size: number;
}

export interface Rule {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatFooterProps {
  onSendMessage: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipFirstRequestLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
    thinking?: boolean,
  ) => void | Promise<void>;
  isHistoryMode?: boolean;
  messages: any[];
  onToggleTaskDrawer?: () => void;
  isProcessing?: boolean;
}
