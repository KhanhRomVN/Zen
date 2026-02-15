import { ToolAction } from "../../../services/ResponseParser";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system-checkpoint" | "system";
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
  checkpointData?: {
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
  };
  actionIds?: string[]; // Track which action(s) generated this message (for output messages)
  uiHidden?: boolean;
}

export interface Checkpoint {
  id: string;
  conversationId: string;
  filePath: string;
  preEditContent: string; // Content before edit
  postEditContent?: string; // Content after edit (optional)
  timestamp: number;
  toolType: "write_to_file" | "replace_in_file" | "execute_command";
  isComplete: boolean; // Has post-edit content
  actionId?: string; // Track which action created this checkpoint
  messageId?: string; // Track which message contains this action
}

export interface ChatBodyProps {
  messages: Message[];
  isProcessing: boolean;
  onSendToolRequest?: (action: ToolAction, message: Message) => void;
  onSendMessage?: (content: string) => void;

  firstRequestMessageId?: string; // ID of the first request message to skip rendering
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  isAutoExecutingAll?: boolean;
  onExecuteAll?: () => void;
  hasPendingActions?: boolean;
}
