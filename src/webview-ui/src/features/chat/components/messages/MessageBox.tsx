import React from "react";
import { Message } from "../../types/message";
import { ParsedResponse } from "../../services/ResponseParser";
import UserMessageBox from "./UserMessageBox";
import AIMessageBox from "./AIMessageBox";

interface MessageBoxProps {
  message: Message;
  parsedContent: ParsedResponse;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  clickedActions: Set<string>;
  failedActions?: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: any,
    message: Message,
    index: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  requestNumber?: number | null;
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  isLastMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  previousAssistantMessage?: Message;
  isGenerating?: boolean;
  isSimpleMode?: boolean;
  onSendMessage?: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
  ) => void;
  onSelectOption?: (messageId: string, option: string) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  onGitConfirm?: (items: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
}

const MessageBox: React.FC<MessageBoxProps> = (props) => {
  const { message, onRevertConversation } = props;

  if (message.role === "user") {
    return <UserMessageBox message={message} onRevertConversation={onRevertConversation} />;
  }

  return <AIMessageBox {...props} />;
};

export default MessageBox;
