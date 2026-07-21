import React, { useRef, useEffect, useMemo } from "react";
import {
  parseAIResponse,
  ParsedResponse,
  ToolAction,
} from "../../services/ResponseParser";
import { Message } from "../../types/message";
import { EXECUTION_STATUS, TOOL_ACTION_TYPES } from "../../constants/constants";
import { useSettings } from "@/context/SettingsContext";
import { useCollapseSections } from "../../hooks/ui/useCollapseSections";
import { useToolActions } from "../../hooks/tools/useToolActions";
import { useScrollBehavior } from "../../hooks/ui/useScrollBehavior";
import ChatBodySkeleton from "./ChatBodySkeleton";
import SearchBar from "./SearchBar";
import ThinkingRenderer from "./AIMessageBox/blocks/thinking/ThinkingBlock";
import { WarningBlock } from "./AIMessageBox/blocks/warning/WarningBlock";
import ProcessingIndicator from "./ProcessingIndicator";
import MessageBox from "./MessageBox";

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
  terminalStatus?: Record<string, "busy" | "free">;
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
  terminalStatus?: Record<string, "busy" | "free">;
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

  // Track re-renders and prop changes
  const renderCountRef = useRef(0);
  const prevPropsRef = useRef<any>({});
  renderCountRef.current += 1;

  const messagesChanged = prevPropsRef.current.messages !== messages;
  const contentChanged =
    messagesChanged &&
    (prevPropsRef.current.messages?.length !== messages.length ||
      prevPropsRef.current.messages?.some(
        (m: any, i: number) =>
          messages[i] &&
          (m.id !== messages[i].id || m.content !== messages[i].content),
      ));

  // Track which props changed
  const propsChanges = {
    messages: prevPropsRef.current.messages !== messages,
    isProcessing: prevPropsRef.current.isProcessing !== isProcessing,
    executionState: prevPropsRef.current.executionState !== executionState,
    toolOutputs: prevPropsRef.current.toolOutputs !== toolOutputs,
    terminalStatus: prevPropsRef.current.terminalStatus !== terminalStatus,
    clickedActions: prevPropsRef.current.clickedActions !== undefined, // will track in useToolActions
    onSendToolRequest:
      prevPropsRef.current.onSendToolRequest !== onSendToolRequest,
    onSendMessage: prevPropsRef.current.onSendMessage !== onSendMessage,
    onToolAction: prevPropsRef.current.onToolAction !== onToolAction,
  };

  prevPropsRef.current = {
    messages,
    isProcessing,
    executionState,
    toolOutputs,
    terminalStatus,
    onSendToolRequest,
    onSendMessage,
    onToolAction,
  };

  const parseCacheRef = useRef<Map<string, ParsedResponse>>(new Map());
  const lastParsedMessagesRef = useRef<any[]>([]);

  const parsedMessages = useMemo(() => {
    const startTime = performance.now();

    // Check if messages are already parsed (from ChatPanel)
    if (messages.length > 0 && messages[0].parsed !== undefined) {
      // STREAMING FIX: During streaming, always check content changes for last message
      const lastMsg = messages[messages.length - 1];
      const lastParsed = lastParsedMessagesRef.current[messages.length - 1];

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

    const result = messages.map((msg, index) => {
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
      (action: any, idx: number) => {
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

    // Kiểm tra message.thinking (SSE stream)
    if (lastMessage.thinking && lastMessage.thinking.trim().length > 0) {
      return false;
    }

    // Kiểm tra thinking blocks trong contentBlocks
    const hasThinkingBlock =
      parsed.contentBlocks &&
      parsed.contentBlocks.some((b: any) => b.type === "thinking");
    if (hasThinkingBlock) {
      return false;
    }

    // Kiểm tra text content
    const hasText = parsed.displayText && parsed.displayText.trim().length > 0;
    if (hasText) {
      return false;
    }

    // Kiểm tra actions
    const hasActions = parsed.actions && parsed.actions.length > 0;
    if (hasActions) {
      return false;
    }

    // Kiểm tra other blocks (code, file, markdown, mixed_content) - skip thinking
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
          case "mixed_content":
            return (b as any).segments?.length > 0;
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
                <MessageBox
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

          {isContinuing && (
            <WarningBlock
              label="CONTINUING RESPONSE"
              message="AI response was interrupted. Fetching the remaining content…"
              isPulsing={true}
            />
          )}

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
