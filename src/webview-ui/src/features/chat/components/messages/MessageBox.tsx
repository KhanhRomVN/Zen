import React from "react";
import { Message } from "../../types/message";
import { ParsedResponse } from "../../services/ResponseParser";
import UserMessageBox from "./UserMessageBox";
import AIMessageBox from "./AIMessageBox";
import { ModelUsageInfo } from "../ModelUsageInfo";

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
  hasNextAssistantMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  previousAssistantMessage?: Message;
  isGenerating?: boolean;
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
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
  responseNumber?: number | null;
}

const MessageBoxComponent: React.FC<MessageBoxProps> = (props) => {
  const { message, onRevertConversation } = props;
  if (message.role === "user") {
    return (
      <UserMessageBox
        message={message}
        onRevertConversation={onRevertConversation}
      />
    );
  }

  // Handle system messages (e.g., model switch)
  if (message.role === "system") {
    // Check if it's a model switch message
    if (message.content.startsWith("__MODEL_SWITCH__::")) {
      try {
        const dataStr = message.content.replace("__MODEL_SWITCH__::", "");
        const data = JSON.parse(dataStr);

        return (
          <div style={{ padding: "12px 0" }}>
            <ModelUsageInfo
              providerId={data.providerId}
              modelId={data.modelId}
              email={data.email}
              websiteUrl={data.websiteUrl}
            />
          </div>
        );
      } catch (e) {
        console.error("Failed to parse model switch message:", e);
        return null;
      }
    }

    // Other system messages
    return null;
  }

  return <AIMessageBox {...props} />;
};

// Memoize to prevent unnecessary re-renders
let memoCheckCount = 0;
const MessageBox = React.memo(MessageBoxComponent, (prevProps, nextProps) => {
  const startTime = performance.now();
  memoCheckCount++;

  // Return true to SKIP re-render (props are equal)
  // Only re-render if message content, clickedActions, or key props change
  //
  // When streaming (isGenerating=true), content changes on every chunk.
  // We still need to re-render to show new text, but we skip the comparison
  // for heavy props like toolOutputs/allMessages since they don't change mid-stream.
  const isStreaming =
    prevProps.isGenerating === true && nextProps.isGenerating === true;

  // During streaming, only check props that actually change per chunk
  if (isStreaming) {
    const streamingPropsEqual =
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.thinking === nextProps.message.thinking &&
      prevProps.clickedActions === nextProps.clickedActions &&
      prevProps.failedActions === nextProps.failedActions &&
      prevProps.rejectedActions === nextProps.rejectedActions;
    return streamingPropsEqual;
  }

  // Full comparison when not streaming
  const propsAreEqual =
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.thinking === nextProps.message.thinking &&
    prevProps.clickedActions === nextProps.clickedActions &&
    prevProps.failedActions === nextProps.failedActions &&
    prevProps.rejectedActions === nextProps.rejectedActions &&
    prevProps.isGenerating === nextProps.isGenerating &&
    prevProps.toolOutputs === nextProps.toolOutputs;
  return propsAreEqual; // true = skip re-render, false = do re-render
});

export default MessageBox;
