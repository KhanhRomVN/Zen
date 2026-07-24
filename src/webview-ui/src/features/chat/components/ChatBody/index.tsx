import React, { useRef, useEffect, useMemo } from "react";
import {
  parseAIResponse,
  ParsedResponse,
  ToolAction,
} from "../../services/ResponseParser";
import { Message } from "../../types/message";
import {
  EXECUTION_STATUS,
  TOOL_ACTION_TYPES,
  TERMINAL_STATUS,
} from "../../constants/constants";
import { useSettings } from "@/context/SettingsContext";
import { useCollapseSections } from "../../hooks/ui/useCollapseSections";
import { useToolActions } from "../../hooks/tools/useToolActions";
import { useScrollBehavior } from "../../hooks/ui/useScrollBehavior";
import ChatBodySkeleton from "./ChatBodySkeleton";
import SearchBar from "./SearchBar";
import { ThinkingRenderer } from "./AIMessageBox/renderers/ThinkingRenderer";
import ContinuingIndicator from "./ContinuingIndicatorBox";
import ProcessingIndicator from "./ProcessingIndicator";
import UserMessageBox from "./UserMessageBox";
import AIMessageBox from "./AIMessageBox";
import ModelInfoBar from "./ModelInfoBar";

interface ChatBodyProps {
  messages: Message[];
  isProcessing: boolean;
  onSendToolRequest?: (
    action: ToolAction | ToolAction[],
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
}

export interface ExtendedChatBodyProps extends ChatBodyProps {
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
// MessageBox Props Interface
// ─────────────────────────────────────────────────────────────────────────────

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
  onRetryRequest?: (messageId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageBox Component (Inline - previously in MessageBox.tsx)
// ─────────────────────────────────────────────────────────────────────────────

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

  return <AIMessageBox {...props} />;
};

// Memoize to prevent unnecessary re-renders
const MessageBox = React.memo(MessageBoxComponent, (prevProps, nextProps) => {
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

// Wrap with error boundary
const MessageBoxWithErrorBoundary: React.FC<MessageBoxProps> = (props) => (
  <MessageBoxErrorBoundary>
    <MessageBox {...props} />
  </MessageBoxErrorBoundary>
);

// ─────────────────────────────────────────────────────────────────────────────
// ChatBody Component
// ─────────────────────────────────────────────────────────────────────────────

const ChatBodyInternal: React.FC<ExtendedChatBodyProps> = ({
  messages,
  isProcessing,
  onSendToolRequest,
  onSendMessage,
  executionState,
  toolOutputs,
  terminalStatus,
  firstRequestMessageId,
  onLoadConversation,
  activeTerminalIds,
  attachedTerminalIds,
  conversationId,
  onToolAction,
  onSelectOption,
  isRestored = false,
  isContinuing = false,
  onContinue,
  hasInitialMessage = false,
  onRevertConversation,
  onAutoScrollPausedChange,
  scrollToBottomRef,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
  isSearchOpen = false,
  searchQuery = "",
  onSearchQueryChange,
  onCloseSearch,
  onGitConfirm,
  onGitCancel,
  gitStatusItems,
  gitStatusBranch,
  isGitProcessing,
  isGitStatusVisible = true,
  onBackToHome,
  isLoadingConversation = false,
}: ExtendedChatBodyProps) => {
  const { permissionMode } = useSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const parseCacheRef = useRef<Map<string, ParsedResponse>>(new Map());
  const lastParsedMessagesRef = useRef<any[]>([]);

  const parsedMessages = useMemo(() => {
    const startTime = performance.now();

    // Check if messages are already parsed (from ChatPanel)
    if (messages.length > 0 && messages[0].parsed !== undefined) {
      // STREAMING FIX: During streaming, always check content changes for last message
      const messagesUnchanged =
        lastParsedMessagesRef.current.length === messages.length &&
        messages.every(
          (msg, i) =>
            msg.id === lastParsedMessagesRef.current[i]?.id &&
            msg.content === lastParsedMessagesRef.current[i]?.content,
        );

      if (messagesUnchanged) {
        return lastParsedMessagesRef.current;
      }

      // Content changed or new messages - update cache
      lastParsedMessagesRef.current = messages;
      return messages;
    }

    // Fallback: parse messages if not already parsed
    const cache = parseCacheRef.current;

    const result = messages.map((msg) => {
      const cached = cache.get(msg.content);
      if (!cached || cached === undefined) {
        const parsed = parseAIResponse(msg.content);
        cache.set(msg.content, parsed);
      }
      return { ...msg, parsed: cache.get(msg.content)! };
    });

    const elapsed = performance.now() - startTime;
    if (elapsed > 10 || messages.length > 10) {
      console.warn(
        `[ChatBody] parsedMessages recalculated - messages: ${messages.length}, cacheSize: ${cache.size}, time: ${elapsed.toFixed(1)}ms`,
      );
    }
    lastParsedMessagesRef.current = result;
    return result;
  }, [messages]);

  const { collapsedSections, toggleCollapse } = useCollapseSections();
  const { clickedActions, handleToolClick, failedActions, rejectedActions } =
    useToolActions({
      onSendToolRequest,
      onToolAction,
      parsedMessages,
      isProcessing,
      isRestored,
    });
  const { autoScrollPaused, scrollToBottom } = useScrollBehavior(
    messagesEndRef,
    bodyRef,
    messages,
    isProcessing,
  );

  const prevPausedRef = useRef(false);
  useEffect(() => {
    if (autoScrollPaused !== prevPausedRef.current) {
      prevPausedRef.current = autoScrollPaused;
      onAutoScrollPausedChange?.(autoScrollPaused);
    }
  }, [autoScrollPaused, onAutoScrollPausedChange]);

  useEffect(() => {
    if (scrollToBottomRef) scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom, scrollToBottomRef]);

  const hasUnexecutedAutoActions = useMemo(() => {
    if (!isRestored || messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    const parsed = parseAIResponse(lastMessage.content);
    if (!parsed.actions || parsed.actions.length === 0) return false;
    const firstPendingAction = parsed.actions.find(
      (_action: any, idx: number) => {
        const actionId = `${lastMessage.id}-action-${idx}`;
        const hasOutput = toolOutputs && toolOutputs[actionId];
        const isClicked = clickedActions.has(actionId);
        return !hasOutput && !isClicked;
      },
    );
    if (!firstPendingAction) return false;
    // Complex mode: always show all tools, never auto-approve
    return false;
  }, [messages, isRestored, toolOutputs, permissionMode, clickedActions]);

  const visibleMessages = useMemo(() => {
    const filtered = messages.filter(
      (msg) => !msg.uiHidden && !msg.isCancelled,
    );
    return filtered;
  }, [messages, firstRequestMessageId]);

  const lastAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [visibleMessages]);

  const isResponding = useMemo(() => {
    if (!isProcessing || visibleMessages.length === 0) return false;
    const lastMessage = visibleMessages[visibleMessages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    const parsedMessage = parsedMessages.find((pm) => pm.id === lastMessage.id);
    if (!parsedMessage || !parsedMessage.parsed) return false;
    const parsed = parsedMessage.parsed;

    // Check message.thinking (SSE stream)
    if (lastMessage.thinking && lastMessage.thinking.trim().length > 0) {
      return false;
    }

    // Check thinking blocks in contentBlocks
    const hasThinkingBlock =
      parsed.contentBlocks &&
      parsed.contentBlocks.some((b: any) => b.type === "thinking");
    if (hasThinkingBlock) {
      return false;
    }

    // Check text content
    const hasText = parsed.displayText && parsed.displayText.trim().length > 0;
    if (hasText) {
      return false;
    }

    // Check actions
    const hasActions = parsed.actions && parsed.actions.length > 0;
    if (hasActions) {
      return false;
    }

    // Check other blocks (code, file, markdown) - skip thinking
    const hasOtherBlocks =
      parsed.contentBlocks &&
      parsed.contentBlocks.some((b: any) => {
        // Skip thinking blocks - they're rendered separately
        if (b.type === "thinking") {
          return false;
        }
        switch (b.type) {
          case "tool":
            return true; // Tools count as content
          case "code":
          case "file":
          case "markdown":
            return (b as any).content?.trim().length > 0;
          default:
            return false;
        }
      });

    if (hasOtherBlocks) {
      return false;
    }

    return true;
  }, [isProcessing, visibleMessages, parsedMessages]);

  return (
    <div
      ref={bodyRef}
      className="chat-body-scroll"
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "var(--spacing-lg)",
        paddingLeft: "24px",
        backgroundColor: "var(--secondary-bg)",
        paddingBottom:
          visibleMessages.length > 0 ? "200px" : "var(--spacing-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
        fontSize: "14px",
        position: "relative",
      }}
    >
      {/* Show skeleton when loading conversation */}
      {isLoadingConversation ? (
        <ChatBodySkeleton />
      ) : (
        <>
          {isSearchOpen && (
            <SearchBar
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              onCloseSearch={onCloseSearch}
              bodyRef={bodyRef}
            />
          )}

          {(() => {
            let assistantResponseCount = 0;
            return visibleMessages.map((message, index) => {
              const parsedMessage = parsedMessages.find(
                (pm) => pm.id === message.id,
              );
              if (!parsedMessage || !parsedMessage.parsed) return null;
              const parsedContent = parsedMessage.parsed;

              // Track assistant response number
              if (message.role === "assistant") {
                assistantResponseCount++;
              }
              const currentResponseNumber =
                message.role === "assistant" ? assistantResponseCount : null;

              const nextUserMessage = messages
                .slice(messages.findIndex((m) => m.id === message.id) + 1)
                .find((m) => m.role === "user");
              const previousAssistantMessage = messages
                .slice(
                  0,
                  messages.findIndex((m) => m.id === message.id),
                )
                .reverse()
                .find((m) => m.role === "assistant");

              const nextVisibleMessage = visibleMessages[index + 1];
              const hasNextAssistantMessage =
                nextVisibleMessage?.role === "assistant";

              return (
                <MessageBoxWithErrorBoundary
                  key={message.id}
                  message={message}
                  parsedContent={parsedContent}
                  nextUserMessage={nextUserMessage}
                  responseNumber={currentResponseNumber}
                  isGenerating={
                    isProcessing && index === visibleMessages.length - 1
                  }
                  isCollapsed={
                    message.role === "user"
                      ? collapsedSections.has(`prompt-${message.id}`)
                      : false
                  }
                  onToggleCollapse={() =>
                    toggleCollapse(`prompt-${message.id}`)
                  }
                  clickedActions={clickedActions}
                  failedActions={failedActions}
                  rejectedActions={rejectedActions}
                  onToolClick={handleToolClick}
                  executionState={executionState}
                  isLastMessage={
                    message.role === "assistant" &&
                    (index === visibleMessages.length - 1 ||
                      index === lastAssistantIndex) &&
                    hasNextAssistantMessage === false
                  }
                  hasNextAssistantMessage={hasNextAssistantMessage}
                  toolOutputs={toolOutputs}
                  terminalStatus={terminalStatus}
                  allMessages={messages}
                  activeTerminalIds={activeTerminalIds}
                  attachedTerminalIds={attachedTerminalIds}
                  conversationId={conversationId}
                  previousAssistantMessage={previousAssistantMessage}
                  onSendMessage={onSendMessage}
                  onSelectOption={onSelectOption}
                  onRevertConversation={onRevertConversation}
                  singleLineReviewActions={singleLineReviewActions}
                  onConfirmSingleLineAction={onConfirmSingleLineAction}
                  onRejectSingleLineAction={onRejectSingleLineAction}
                  onGitConfirm={onGitConfirm}
                  onGitCancel={onGitCancel}
                  gitStatusItems={gitStatusItems}
                  gitStatusBranch={gitStatusBranch}
                  isGitProcessing={isGitProcessing}
                  isGitStatusVisible={isGitStatusVisible}
                  onBackToHome={onBackToHome}
                  onRetryRequest={(messageId: string) => {
                    // Find the user message before this assistant message
                    const msgIndex = messages.findIndex((m) => m.id === messageId);
                    if (msgIndex <= 0) return;
                    
                    let prevUserMsg: Message | null = null;
                    for (let i = msgIndex - 1; i >= 0; i--) {
                      if (messages[i].role === "user") {
                        prevUserMsg = messages[i];
                        break;
                      }
                    }
                    
                    if (!prevUserMsg) return;
                    
                    // First revert to this message (removes all messages after)
                    if (onRevertConversation) {
                      onRevertConversation(messageId, message.timestamp);
                    }
                    
                    // Then resend the user message
                    if (onSendMessage && prevUserMsg.rawRequest) {
                      // Small delay to let revert complete
                      setTimeout(() => {
                        onSendMessage(
                          prevUserMsg!.rawRequest || prevUserMsg!.content,
                          prevUserMsg!.uploadedFiles,
                          undefined,
                          undefined,
                          false,
                        );
                      }, 100);
                    }
                  }}
                />
              );
            });
          })()}

          {(() => {
            const lastMessage = visibleMessages[visibleMessages.length - 1];
            const isRenderingThinking =
              lastMessage && lastMessage.role === "assistant" && isProcessing;

            if (!isRenderingThinking) {
              return null;
            }

            // Check for thinking from SSE stream (unclosed thinking)
            const hasSSEThinking =
              lastMessage.thinking && lastMessage.thinking.trim();

            if (hasSSEThinking) {
              return (
                <ThinkingRenderer
                  content={lastMessage.thinking!}
                  maxHeight={240}
                  isStreaming={true}
                />
              );
            }

            // Check for unclosed thinking blocks in parsed content
            const parsedMessage = parsedMessages.find(
              (pm) => pm.id === lastMessage.id,
            );
            if (!parsedMessage || !parsedMessage.parsed) {
              return null;
            }

            // Look for UNCLOSED thinking block (still streaming)
            const contentBlocks = parsedMessage.parsed.contentBlocks || [];
            const lastBlock = contentBlocks[contentBlocks.length - 1];
            const isLastBlockUnclosedThinking =
              lastBlock &&
              lastBlock.type === "thinking" &&
              lastBlock.content?.trim();

            // Only render if the LAST block is a thinking block (means thinking is still open/unclosed)
            if (isLastBlockUnclosedThinking) {
              return (
                <ThinkingRenderer
                  content={lastBlock.content!}
                  maxHeight={240}
                  isStreaming={true}
                />
              );
            }

            return null;
          })()}

          {hasUnexecutedAutoActions && onContinue && (
            <div
              style={{
                marginTop: "12px",
                marginBottom: "12px",
                display: "flex",
              }}
            >
              <button
                onClick={onContinue}
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--vscode-button-background, #007acc) 15%, transparent)",
                  color: "var(--vscode-button-background, #007acc)",
                  border:
                    "1px solid color-mix(in srgb, var(--vscode-button-background, #007acc) 30%, transparent)",
                  padding: "6px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  height: "28px",
                  boxSizing: "border-box",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "color-mix(in srgb, var(--vscode-button-background, #007acc) 25%, transparent)";
                  e.currentTarget.style.borderColor =
                    "color-mix(in srgb, var(--vscode-button-background, #007acc) 50%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "color-mix(in srgb, var(--vscode-button-background, #007acc) 15%, transparent)";
                  e.currentTarget.style.borderColor =
                    "color-mix(in srgb, var(--vscode-button-background, #007acc) 30%, transparent)";
                }}
              >
                <span
                  className="codicon codicon-play"
                  style={{
                    fontSize: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
                <span>Continue Task</span>
              </button>
            </div>
          )}

          {isContinuing && <ContinuingIndicator />}

          {(isProcessing || hasInitialMessage) && (
            <ProcessingIndicator isResponding={isResponding} />
          )}

          <div ref={messagesEndRef} />
          <style>{`
        .chat-body-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .chat-body-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-body-scroll::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background, rgba(128, 128, 128, 0.4));
          border-radius: 4px;
        }
        .chat-body-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground, rgba(128, 128, 128, 0.6));
        }
        .chat-body-scroll {
          scrollbar-width: thin;
        }
      `}</style>
        </>
      )}
    </div>
  );
};

// PERF: React.memo with custom comparator to prevent re-renders when parent
// (ChatPanel) re-renders due to unrelated state changes (e.g., useBrowserSession polling).
// ChatBody has ~30 props; without memo it re-renders the entire message list
// and triggers 150+ MessageBox memo checks on every parent render.
const ChatBody = React.memo(ChatBodyInternal, (prevProps, nextProps) => {
  return (
    prevProps.messages === nextProps.messages &&
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.isContinuing === nextProps.isContinuing &&
    prevProps.executionState === nextProps.executionState &&
    prevProps.toolOutputs === nextProps.toolOutputs &&
    prevProps.terminalStatus === nextProps.terminalStatus &&
    prevProps.conversationId === nextProps.conversationId &&
    prevProps.isRestored === nextProps.isRestored &&
    prevProps.isSearchOpen === nextProps.isSearchOpen &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.isLoadingConversation === nextProps.isLoadingConversation &&
    prevProps.isGitProcessing === nextProps.isGitProcessing &&
    prevProps.isGitStatusVisible === nextProps.isGitStatusVisible &&
    prevProps.singleLineReviewActions === nextProps.singleLineReviewActions
  );
});
export default ChatBody;
