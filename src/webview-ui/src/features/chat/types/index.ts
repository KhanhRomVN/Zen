import { ToolAction } from "../services/ResponseParser";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  token_usage?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  actionIds?: string[]; // Track which action(s) generated this message (for output messages)
  uiHidden?: boolean;
  isCancelled?: boolean;
  conversationId?: string; // Real backend conversation ID for this message
  providerId?: string;
  modelId?: string;
  accountId?: string;
  websiteUrl?: string;
  email?: string;
  isError?: boolean;
  selectedOption?: string;
  thinking?: string;
  clickedActions?: string[];
  rejectedActions?: string[];
  response_message_id?: string; // DeepSeek parent_message_id for revert support
}

export interface ChatBodyProps {
  messages: Message[];
  isProcessing: boolean;
  onSendToolRequest?: (
    action: ToolAction | ToolAction[],
    message: Message,
    isAutoTrigger?: boolean,
    actionType?: "accept_all" | "accept_once" | "reject",
  ) => void;
  onToolAction?: (
    actionId: string,
    actionType: "accept_all" | "accept_once" | "reject",
    toolName?: string,
  ) => void;
  onSendMessage?: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipFirstRequestLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
  ) => void | Promise<void>;
  onSelectOption?: (messageId: string, option: string) => void;

  firstRequestMessageId?: string; // ID of the first request message to skip rendering
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  onAutoScrollPausedChange?: (paused: boolean) => void;
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
  // DeepSeek incomplete SSE continuation
  isContinuing?: boolean;
  incompleteHasPartialTool?: boolean;
  incompletePartialToolType?: string | null;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // Base64 or text content
  file_id?: string;
  isUploading?: boolean;
  error?: string;
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
