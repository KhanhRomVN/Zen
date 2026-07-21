import { ToolAction } from "@/features/chat/services/ResponseParser";
import { Message, Question } from "@/features/chat/types/message";
import { ToolOutputs } from "@/features/chat/types/tool-outputs";
import { TOOL_ACTION_TYPES } from "@/features/chat/constants/constants";

// ============= GROUP TYPES =============

/**
 * Represents different types of content groups that can be rendered in the chat
 */
export type GroupType =
  | {
      type: "tools";
      items: { action: ToolAction; index: number }[];
      key: string;
    }
  | { type: "markdown"; content: string; key: string }
  | {
      type: "question";
      options: string[];
      title?: string;
      optional?: boolean;
      questions?: Question[];
      key: string;
    }
  | {
      type: "error";
      content: string;
      errorCode?: string;
      toolName?: string;
      toolParams?: Record<string, any>;
      key: string;
    }
  | { type: "warning"; label: string; message: string; key: string }
  | { type: "thinking"; content: string; key: string };

// ============= RENDERER PROPS =============

/**
 * Common props shared across all renderer components
 */
export interface BaseRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked: boolean;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: ToolOutputs;
  allMessages?: Message[];
  fileStatsMap: Record<string, { lines: number; loading: boolean }>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    index: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  conversationId?: string;
}

/**
 * Props for renderers that support merged actions (write, replace)
 */
export interface MergedRendererProps extends BaseRendererProps {
  mergedItems?: { action: ToolAction; index: number }[];
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
}

/**
 * Diagnostic information from language server
 */
export interface Diagnostic {
  severity: string;
  message: string;
  line: number;
  column: number;
  source?: string;
  code?: string | number;
}

/**
 * Diff statistics for replace/revert operations
 */
export interface DiffStats {
  added: number;
  removed: number;
}

/**
 * File tree node structure
 */
export interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}
