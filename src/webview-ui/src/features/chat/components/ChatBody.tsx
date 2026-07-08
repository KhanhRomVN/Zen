import React, { useRef, useEffect, useMemo } from "react";
import {
  parseAIResponse,
  ParsedResponse,
  ToolAction,
} from "../services/ResponseParser";
import { useSettings } from "../../../context/SettingsContext";
import { useCollapseSections } from "../hooks/ui/useCollapseSections";
import { useToolActions } from "../hooks/tools/useToolActions";
import { useScrollBehavior } from "../hooks/ui/useScrollBehavior";
import { Message } from "../types/message";
import ProcessingIndicator from "./messages/ProcessingIndicator";
import MessageBox from "./messages/MessageBox";
import SearchBar from "./SearchBar";
import { ChatErrorBoundary } from "./ChatErrorBoundary";
import { getPermissionDecision } from "../utils/permissionUtils";

interface ChatBodyProps {
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
  /** ID of the first user message — used to skip rendering it in some views. */
  firstRequestMessageId?: string;
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
  /** DeepSeek incomplete SSE continuation flags. */
  isContinuing?: boolean;
  incompleteHasPartialTool?: boolean;
  incompletePartialToolType?: string | null;
  onGitConfirm?: (items: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
}

export interface ExtendedChatBodyProps extends ChatBodyProps {
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
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

const ChatBody: React.FC<ExtendedChatBodyProps> = ({
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
  incompleteHasPartialTool = false,
  incompletePartialToolType = null,
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
}: ExtendedChatBodyProps) => {
  const { permissionMode } = useSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const parseCacheRef = useRef<Map<string, ParsedResponse>>(new Map());

  const parsedMessages = useMemo(() => {
    const cache = parseCacheRef.current;
    const result = messages.map((msg) => {
      // Always re-parse if content changed (for streaming)
      const cached = cache.get(msg.content);
      if (!cached || cached === undefined) {
        const parsed = parseAIResponse(msg.content);
        // 🔍 Only log if something went wrong
        if (parsed.contentBlocks.length === 0 && msg.content.trim().length > 50) {
          console.warn("[Zen][ChatBody] No blocks generated for message:", {
            messageId: msg.id,
            contentLength: msg.content.length,
            contentPreview: msg.content.substring(0, 100),
          });
        }
        cache.set(msg.content, parsed);
      }
      return { ...msg, parsed: cache.get(msg.content)! };
    });
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
    [messages, isProcessing],
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
        if (action.isPartial) return false;
        const actionId = `${lastMessage.id}-action-${idx}`;
        const hasOutput = toolOutputs && toolOutputs[actionId];
        const isClicked = clickedActions.has(actionId);
        return !hasOutput && !isClicked;
      },
    );
    if (!firstPendingAction) return false;
    // Complex mode: always show all tools, never auto-approve
    return false;
  }, [
    messages,
    isRestored,
    toolOutputs,
    permissionMode,
    clickedActions,
  ]);

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
    if (!parsedMessage) return false;
    const parsed = parsedMessage.parsed;
    const hasText = parsed.displayText && parsed.displayText.trim().length > 0;
    const hasActions = parsed.actions && parsed.actions.length > 0;
    const hasOtherBlocks =
      parsed.contentBlocks &&
      parsed.contentBlocks.some((b) => {
        switch (b.type) {
          case "tool":
            return true;
          case "mixed_content":
            return b.segments.length > 0;
          case "code":
          case "file":
          case "markdown":
            return b.content.trim().length > 0;
          default:
            return false;
        }
      });
    return !!(hasText || hasActions || hasOtherBlocks);
  }, [isProcessing, visibleMessages, parsedMessages]);

  return (
    <div
      ref={bodyRef}
      className="chat-body-scroll"
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--spacing-lg)",
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
      {isSearchOpen && (
        <SearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onCloseSearch={onCloseSearch}
          bodyRef={bodyRef}
        />
      )}

      {/* ── New messages indicator ─────────────────────────────────────── */}
      {autoScrollPaused && isProcessing && (
        <div
          style={{
            position: "sticky",
            bottom: "12px",
            zIndex: 20,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <button
            onClick={scrollToBottom}
            style={{
              pointerEvents: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "20px",
              border:
                "1px solid color-mix(in srgb, var(--vscode-button-background, #007acc) 40%, transparent)",
              background:
                "color-mix(in srgb, var(--vscode-editor-background) 85%, var(--vscode-button-background, #007acc))",
              color: "var(--vscode-button-background, #007acc)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              transition: "opacity 0.2s",
            }}
          >
            <span
              className="codicon codicon-arrow-down"
              style={{ fontSize: "11px" }}
            />
            New messages
          </button>
        </div>
      )}
      <div className="chat-timeline-wrapper">
        {visibleMessages.map((message, index) => {
          const parsedMessage = parsedMessages.find(
            (pm) => pm.id === message.id,
          );
          if (!parsedMessage) return null;
          const parsedContent = parsedMessage.parsed;

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
          
          // Check if next visible message is assistant (for timeline line logic)
          const nextVisibleMessage = visibleMessages[index + 1];
          const hasNextAssistantMessage = nextVisibleMessage?.role === "assistant";
          
          return (
            <ChatErrorBoundary key={message.id}>
              <MessageBox
                key={message.id}
                message={message}
                parsedContent={parsedContent}
                nextUserMessage={nextUserMessage}
                isGenerating={
                  isProcessing && index === visibleMessages.length - 1
                }
                isCollapsed={
                  message.role === "user"
                    ? collapsedSections.has(`prompt-${message.id}`)
                    : false
                }
                onToggleCollapse={() => toggleCollapse(`prompt-${message.id}`)}
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
            </ChatErrorBoundary>
          );
        })}
      </div>

      {hasUnexecutedAutoActions && onContinue && (
        <div
          style={{
            paddingLeft: "29px",
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "8px 14px",
            marginBottom: "4px",
            marginTop: "4px",
            background:
              "color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 8%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 25%, transparent)",
            borderRadius: "8px",
            color: "var(--vscode-editor-foreground)",
            fontSize: "12px",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              marginTop: "2px",
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--vscode-editorWarning-foreground, #cca700)",
              animation: "zen-pulse 1.2s ease-in-out infinite",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 600, opacity: 0.9 }}>
              Response bị ngắt — đang tiếp tục…
            </span>
            <span style={{ opacity: 0.7, lineHeight: "1.4" }}>
              {incompleteHasPartialTool
                ? `AI tự động ngắt response dài. Đang ghép phần còn lại của \`${incompletePartialToolType ?? "tool"}\` trước khi thực thi.`
                : "AI tự động ngắt response dài. Đang lấy phần còn lại…"}
            </span>
          </div>
          <style>{`
            @keyframes zen-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(0.75); }
            }
          `}</style>
        </div>
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
    </div>
  );
};

export default ChatBody;
