import React from "react";
import { Message } from "../../types/message";
import {
  EXECUTION_STATUS,
  TOOL_ACTION_TYPES,
  TERMINAL_STATUS,
} from "../../constants/constants";
import { ParsedResponse } from "../../services/ResponseParser";
import UserMessageBox from "./UserMessageBox";
import AIMessageBox from "./AIMessageBox";

// ─────────────────────────────────────────────────────────────────────────────
// MessageBox Props Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface MessageBoxProps {
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
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  requestNumber?: number | null;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  isLastMessage?: boolean;
  hasNextAssistantMessage?: boolean;
  isRestored?: boolean;
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
    extraOptions?: {
      user_action?: string;
      edit_message_id?: string;
      parent_message_id?: string;
    },
  ) => void;
  onSelectOption?: (messageId: string, option: string) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  onRegenerateRequest?: (messageId: string) => void;
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
  onRetryRequest?: (messageId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary for Message Rendering
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for MessageBox.
 * Catches render errors and shows a recoverable error UI instead of crashing.
 */
class MessageBoxErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[MessageBox] Render error caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const errorColor = "var(--vscode-errorForeground, #f44336)";

      return (
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "16px",
                  height: "16px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "2px",
                }}
                title="Error - Render failed"
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: errorColor,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                flexShrink: 0,
                marginLeft: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: errorColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                ERROR
              </span>
            </div>
          </div>

          {this.state.error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "6px",
                border: `1px solid color-mix(in srgb, ${errorColor} 30%, transparent)`,
                background: `color-mix(in srgb, ${errorColor} 5%, transparent)`,
              }}
            >
              <pre
                style={{
                  fontSize: "11px",
                  color: "var(--vscode-descriptionForeground)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "120px",
                  overflowY: "auto",
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                }}
              >
                {this.state.error.message}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageBox Component
// ─────────────────────────────────────────────────────────────────────────────

const MessageBoxComponent: React.FC<MessageBoxProps> = (props) => {
  const { message, onRevertConversation, onRegenerateRequest } = props;

  if (message.role === "user") {
    return (
      <UserMessageBox
        message={message}
        conversationId={(props as any).conversationId}
        onRevertConversation={onRevertConversation}
        onRegenerateRequest={onRegenerateRequest}
        onEditRequest={(props as any).onEditRequest}
      />
    );
  }

  return <AIMessageBox {...props} />;
};

// Memoize to prevent unnecessary re-renders
const MessageBox = React.memo(MessageBoxComponent, (prevProps, nextProps) => {
  const isStreaming =
    prevProps.isGenerating === true && nextProps.isGenerating === true;

  // During streaming, only check props that actually change per chunk
  if (isStreaming) {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.thinking === nextProps.message.thinking &&
      prevProps.clickedActions === nextProps.clickedActions &&
      prevProps.failedActions === nextProps.failedActions &&
      prevProps.rejectedActions === nextProps.rejectedActions
    );
  }

  // Full comparison when not streaming
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.thinking === nextProps.message.thinking &&
    prevProps.clickedActions === nextProps.clickedActions &&
    prevProps.failedActions === nextProps.failedActions &&
    prevProps.rejectedActions === nextProps.rejectedActions &&
    prevProps.isGenerating === nextProps.isGenerating &&
    prevProps.toolOutputs === nextProps.toolOutputs
  );
});

// Wrap with error boundary
const MessageBoxWithErrorBoundary: React.FC<MessageBoxProps> = (props) => (
  <MessageBoxErrorBoundary>
    <MessageBox {...props} />
  </MessageBoxErrorBoundary>
);

export default MessageBoxWithErrorBoundary;
