/**
 * ------------------------------------------------------------------
 * Chat Body Types
 * ------------------------------------------------------------------
 * Định nghĩa các kiểu dữ liệu (interfaces) được sử dụng bởi thành phần
 * ChatBody và các sub-component liên quan. Bao gồm props chính của
 * container chat và các trạng thái mở rộng cho luồng tool execution.
 *
 * Main types:
 * - ChatBodyProps          : Props cơ bản cho component ChatBody
 * - ExtendedChatBodyProps  : Props mở rộng bao gồm trạng thái terminal, search, git...
 * ------------------------------------------------------------------
 */

// ─── Imports ──────────────────────────────────────────────────────────
// ── React ─
import React from "react";

// ── Types & Constants ──
import { Message } from "./message";
import {
  EXECUTION_STATUS,
  TOOL_ACTION_TYPES,
  TERMINAL_STATUS,
} from "../constants/constants";

// ─── Interfaces ────────────────────────────────────────────────────────
export interface ChatBodyProps {
  messages: Message[];
  isProcessing: boolean;
  onSendToolRequest?: (
    action: any | any[],
    message: Message,
    isAutoTrigger?: boolean,
    actionType?: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  onToolAction?: (
    actionId: string,
    actionType: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
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
    extraOptions?: {
      user_action?: string;
      edit_message_id?: string;
      parent_message_id?: string;
    },
  ) => void | Promise<void>;
  onSelectOption?: (messageId: string, option: string) => void;
  /** ID of the first user message — used to skip rendering it in some views. */
  firstRequestMessageId?: string;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<
    string,
    (typeof TERMINAL_STATUS)[keyof typeof TERMINAL_STATUS]
  >;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  onRegenerateRequest?: (messageId: string) => void;
  onAutoScrollPausedChange?: (paused: boolean) => void;
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
  isContinuing?: boolean;
  onGitConfirm?: (items: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
  /** Loading state when restoring conversation from history */
  isLoadingConversation?: boolean;
  /** Whether the current provider supports regenerate/revert mechanism */
  canRegenerate?: boolean;
}

export interface ExtendedChatBodyProps extends ChatBodyProps {
  onRegenerateRequest?: (messageId: string) => void;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<
    string,
    (typeof TERMINAL_STATUS)[keyof typeof TERMINAL_STATUS]
  >;
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  previousAssistantMessage?: Message;
  isRestored?: boolean;
  onContinue?: () => void;
  hasInitialMessage?: boolean;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  isSearchOpen?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onCloseSearch?: () => void;
  /** Tool call format for this conversation */
  toolFormat?: 'xml' | 'json';
  /** Dangerous command warnings keyed by actionId */
  dangerousCommands?: Record<
    string,
    { actionId: string; commandText: string; folderPath?: string; reason: string }
  >;
  onProceedDangerousCommand?: (actionId: string) => void;
  onCancelDangerousCommand?: (actionId: string) => void;

}