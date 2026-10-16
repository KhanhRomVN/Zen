/**
 * ------------------------------------------------------------------
 * ChatBody
 * ------------------------------------------------------------------
 * Container chính hiển thị danh sách tin nhắn trong cuộc trò chuyện.
 * Quản lý parsing nội dung AI, xử lý tool actions,
 * và điều khiển hành vi cuộn (auto-scroll). Tích hợp các thành phần con
 * như SearchBar và MessageBox.
 *
 * Main features:
 * - Caching kết quả parse message để tối ưu hiệu suất
 * - Tự động cuộn xuống đáy khi có tin nhắn mới (có thể tạm dừng)
 * - Hiển thị skeleton loading khi khởi tạo conversation
 * - Hỗ trợ tìm kiếm nhanh trong toàn bộ nội dung chat
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ─
import React, { useRef, useEffect, useMemo } from "react";

// ── Services & Contexts ──
import { parseAIResponse } from "../../services/ResponseParser";
import { useSettings } from "@/context/SettingsContext";
import { useStreamingPreviewStore } from "../../stores/streamingPreviewStore";

// ── Hooks ──
import { useCollapseSections } from "../../hooks/ui/useCollapseSections";
import { useToolActions } from "../../hooks/tools/useToolActions";
import { useScrollBehavior } from "../../hooks/ui/useScrollBehavior";
import { useMessageParsing } from "../../hooks/messages/useMessageParsing";
import { useMessageActions } from "../../hooks/messages/useMessageActions";

// ── Components
import ChatBodySkeleton from "./ChatBodySkeleton";
import SearchBar from "./SearchBar";
import MessageBoxWithErrorBoundary from "./MessageBox";
import ContinueTaskButton from "./ContinueTaskButton";
import WaitingIndicator from "./WaitingIndicator";
// ── Types ─
import { ExtendedChatBodyProps } from "../../types/chat-body.types";

export type { ExtendedChatBodyProps };
// ─── Component ─────────────────────────────────────────────────────────
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
  onRegenerateRequest,
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
  canRegenerate = true,
  isViewOnly = false,
  toolFormat = "xml",
  dangerousCommands,
  onProceedDangerousCommand,
  onCancelDangerousCommand,
}: ExtendedChatBodyProps) => {
  const { permissionMode } = useSettings();
  const hasStreamingContent = useStreamingPreviewStore(
    (state) => state.content.length > 0,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Refs to manage waiting timer without causing unnecessary re-renders of the whole list
  const requestStartTimeRef = useRef<number | null>(null);
  const prevIsProcessingRef = useRef<boolean>(false);

  // Detect rising edge of isProcessing to capture start time synchronously during render
  if (isProcessing && !prevIsProcessingRef.current) {
    requestStartTimeRef.current = Date.now();
  } else if (!isProcessing && prevIsProcessingRef.current) {
    requestStartTimeRef.current = null;
  }
  prevIsProcessingRef.current = isProcessing;

  // Use shared parse cache from useMessageParsing hook
  const parsedMessagesFromHook = useMessageParsing(
    messages,
    isProcessing || isContinuing,
    toolFormat,
  );

  const parsedMessages = useMemo(() => {
    if (messages.length > 0 && messages[0].parsed !== undefined) {
      return messages;
    }
    return parsedMessagesFromHook;
  }, [messages, parsedMessagesFromHook]);

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
  const { handleRegenerateRequest, handleEditRequest, handleRetryRequest } =
    useMessageActions({ messages, onSendMessage, onRevertConversation });

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
    const parsed = parseAIResponse(lastMessage.content, toolFormat);
    if (!parsed.actions || parsed.actions.length === 0) return false;
    const firstPendingAction = parsed.actions.find(
      (_action: any, idx: number) => {
        const actionId = `${lastMessage.id}-action-${idx}`;
        return (
          !(toolOutputs && toolOutputs[actionId]) &&
          !clickedActions.has(actionId)
        );
      },
    );
    if (!firstPendingAction) return false;
    // Complex mode: always show all tools, never auto-approve
    return false;
  }, [messages, isRestored, toolOutputs, permissionMode, clickedActions]);

  const visibleMessages = useMemo(
    () => messages.filter((msg) => !msg.uiHidden && !msg.isCancelled),
    [messages, firstRequestMessageId],
  );

  const lastAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [visibleMessages]);

  // Determine if we are in the "waiting for first chunk" phase:
  // isProcessing=true AND no assistant message has received meaningful content yet
  const isWaitingForResponse = useMemo(() => {
    if (!isProcessing) {
      return false;
    }

    if (!requestStartTimeRef.current) {
      return false;
    }

    if (hasStreamingContent) {
      return false;
    }

    if (visibleMessages.length === 0) {
      return true;
    }

    const lastMsg = visibleMessages[visibleMessages.length - 1];
    if (lastMsg.role !== "assistant") {
      return true;
    }

    const parsedMsg = parsedMessages.find((pm) => pm.id === lastMsg.id);
    if (!parsedMsg?.parsed) {
      return true;
    }

    const p = parsedMsg.parsed;

    // Check conditions that mean we ARE receiving content (so stop waiting)
    if ((lastMsg.thinking?.trim().length ?? 0) > 0) {
      return false;
    }
    if (p.contentBlocks?.some((b: any) => b.type === "thinking")) {
      return false;
    }
    if (p.displayText?.trim().length > 0) {
      return false;
    }
    if (p.actions?.length > 0) {
      return false;
    }
    if (
      p.contentBlocks?.some((b: any) => {
        if (b.type === "thinking") return false;
        switch (b.type) {
          case "tool":
            return true;
          case "code":
          case "file":
          case "markdown":
            return (b as any).content?.trim().length > 0;
          default:
            return false;
        }
      })
    ) {
      return false;
    }

    return true;
  }, [isProcessing, visibleMessages, parsedMessages, hasStreamingContent]);

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
      {isLoadingConversation ? (
        <ChatBodySkeleton />
      ) : (
        <div
          className="chat-body-inner"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-md)",
            width: "100%",
            maxWidth: 900,
            margin: "0 auto",
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

          {(() => {
            // Calculate global response count from ALL messages (not just visible)
            let globalResponseCount = 0;
            const messageToResponseNumber = new Map<string, number>();
            messages.forEach((msg) => {
              if (msg.role === "assistant") {
                globalResponseCount++;
                messageToResponseNumber.set(msg.id, globalResponseCount);
              }
            });

            return visibleMessages.map((message, index) => {
              const parsedMessage = parsedMessages.find(
                (pm) => pm.id === message.id,
              );
              if (!parsedMessage?.parsed) return null;

              const currentResponseNumber =
                message.role === "assistant"
                  ? messageToResponseNumber.get(message.id) || null
                  : null;

              const msgIdx = messages.findIndex((m) => m.id === message.id);
              const nextUserMessage = messages
                .slice(msgIdx + 1)
                .find((m) => m.role === "user");
              const previousAssistantMessage = messages
                .slice(0, msgIdx)
                .reverse()
                .find((m) => m.role === "assistant");

              const nextVisibleMessage = visibleMessages[index + 1];
              const hasNextAssistantMessage =
                nextVisibleMessage?.role === "assistant";

              return (
                <MessageBoxWithErrorBoundary
                  key={message.id}
                  message={message}
                  parsedContent={parsedMessage.parsed}
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
                    !hasNextAssistantMessage
                  }
                  hasNextAssistantMessage={hasNextAssistantMessage}
                  toolOutputs={toolOutputs}
                  terminalStatus={terminalStatus}
                  allMessages={messages}
                  activeTerminalIds={activeTerminalIds}
                  attachedTerminalIds={attachedTerminalIds}
                  conversationId={conversationId}
                  previousAssistantMessage={previousAssistantMessage}
                  isRestored={isRestored}
                  onSendMessage={onSendMessage}
                  onSelectOption={onSelectOption}
                  onRevertConversation={onRevertConversation}
                  onRegenerateRequest={handleRegenerateRequest}
                  {...({ onEditRequest: handleEditRequest } as any)}
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
                  onRetryRequest={handleRetryRequest}
                  canRegenerate={canRegenerate}
                  isViewOnly={isViewOnly}
                  dangerousCommands={dangerousCommands}
                  onProceedDangerousCommand={onProceedDangerousCommand}
                  onCancelDangerousCommand={onCancelDangerousCommand}
                />
              );
            });
          })()}

          {hasUnexecutedAutoActions && onContinue && (
            <ContinueTaskButton onContinue={onContinue} />
          )}

          {(() => {
            return null;
          })()}

          {isWaitingForResponse && requestStartTimeRef.current && (
            <WaitingIndicator startTime={requestStartTimeRef.current} />
          )}

          <div ref={messagesEndRef} />
          <style>{`
        .chat-body-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .chat-body-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-body-scroll::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background, rgba(128, 128, 128, 0.4));
          border-radius: 4px;
        }
        .chat-body-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground, rgba(128, 128, 128, 0.6));
        }
        .chat-body-scroll { scrollbar-width: thin; }
      `}</style>
        </div>
      )}
    </div>
  );
};

// PERF: React.memo with custom comparator to prevent re-renders when parent
// (ChatPanel) re-renders due to unrelated state changes (e.g., useBrowserSession polling).
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
    prevProps.singleLineReviewActions === nextProps.singleLineReviewActions &&
    prevProps.canRegenerate === nextProps.canRegenerate &&
    prevProps.isViewOnly === nextProps.isViewOnly &&
    // [FIX] Ensure dangerousCommands triggers re-render
    prevProps.dangerousCommands === nextProps.dangerousCommands
  );
});

export default ChatBody;
