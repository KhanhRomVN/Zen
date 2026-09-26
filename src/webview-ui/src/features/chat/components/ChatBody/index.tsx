import React, { useRef, useEffect, useMemo } from "react";
import { parseAIResponse } from "../../services/ResponseParser";
import { useSettings } from "@/context/SettingsContext";
import { useCollapseSections } from "../../hooks/ui/useCollapseSections";
import { useToolActions } from "../../hooks/tools/useToolActions";
import { useScrollBehavior } from "../../hooks/ui/useScrollBehavior";
import { useMessagePagination } from "../../hooks/ui/useMessagePagination";
import { useMessageParsing } from "../../hooks/messages/useMessageParsing";
import { useMessageActions } from "../../hooks/messages/useMessageActions";
import ChatBodySkeleton from "./ChatBodySkeleton";
import SearchBar from "./SearchBar";
import ContinuingIndicator from "./ContinuingIndicatorBox";
import ProcessingIndicator from "./ProcessingIndicator";
import { LoadMoreButton } from "./LoadMoreButton";
import MessageBoxWithErrorBoundary from "./MessageBox";
import ContinueTaskButton from "./ContinueTaskButton";
import { ExtendedChatBodyProps } from "./types";

export type { ExtendedChatBodyProps };

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
}: ExtendedChatBodyProps) => {
  const { permissionMode } = useSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Message pagination
  const {
    visibleMessages: paginatedMessages,
    hiddenCount,
    loadMore,
    loadAll,
    hasHiddenMessages,
  } = useMessagePagination({ messages, messagesPerPage: 10 });

  // Use shared parse cache from useMessageParsing hook
  const parsedMessagesFromHook = useMessageParsing(
    paginatedMessages,
    isProcessing || isContinuing,
  );

  const parsedMessages = useMemo(() => {
    if (
      paginatedMessages.length > 0 &&
      paginatedMessages[0].parsed !== undefined
    ) {
      return paginatedMessages;
    }
    return parsedMessagesFromHook;
  }, [paginatedMessages, parsedMessagesFromHook]);

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
    const parsed = parseAIResponse(lastMessage.content);
    if (!parsed.actions || parsed.actions.length === 0) return false;
    const firstPendingAction = parsed.actions.find(
      (_action: any, idx: number) => {
        const actionId = `${lastMessage.id}-action-${idx}`;
        return !(toolOutputs && toolOutputs[actionId]) && !clickedActions.has(actionId);
      },
    );
    if (!firstPendingAction) return false;
    // Complex mode: always show all tools, never auto-approve
    return false;
  }, [messages, isRestored, toolOutputs, permissionMode, clickedActions]);

  const visibleMessages = useMemo(
    () => paginatedMessages.filter((msg) => !msg.uiHidden && !msg.isCancelled),
    [paginatedMessages, firstRequestMessageId],
  );

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
    if (!parsedMessage?.parsed) return false;
    const parsed = parsedMessage.parsed;

    if ((lastMessage.thinking?.trim().length ?? 0) > 0) return false;
    if (parsed.contentBlocks?.some((b: any) => b.type === "thinking")) return false;
    if (parsed.displayText?.trim().length > 0) return false;
    if (parsed.actions?.length > 0) return false;
    if (
      parsed.contentBlocks?.some((b: any) => {
        if (b.type === "thinking") return false;
        switch (b.type) {
          case "tool": return true;
          case "code":
          case "file":
          case "markdown": return (b as any).content?.trim().length > 0;
          default: return false;
        }
      })
    ) return false;

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
        paddingBottom: visibleMessages.length > 0 ? "200px" : "var(--spacing-lg)",
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
        <>
          {isSearchOpen && (
            <SearchBar
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              onCloseSearch={onCloseSearch}
              bodyRef={bodyRef}
            />
          )}

          {hasHiddenMessages && (
            <LoadMoreButton
              hiddenCount={hiddenCount}
              onLoadMore={loadMore}
              onLoadAll={loadAll}
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
              const parsedMessage = parsedMessages.find((pm) => pm.id === message.id);
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
              const hasNextAssistantMessage = nextVisibleMessage?.role === "assistant";

              return (
                <MessageBoxWithErrorBoundary
                  key={message.id}
                  message={message}
                  parsedContent={parsedMessage.parsed}
                  nextUserMessage={nextUserMessage}
                  responseNumber={currentResponseNumber}
                  isGenerating={isProcessing && index === visibleMessages.length - 1}
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
                    (index === visibleMessages.length - 1 || index === lastAssistantIndex) &&
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
                />
              );
            });
          })()}

          {/* PERF: Da bo streaming render ThinkingBlock — ProcessingIndicator thay the hoan toan */}

          {hasUnexecutedAutoActions && onContinue && (
            <ContinueTaskButton onContinue={onContinue} />
          )}

          {isContinuing && <ContinuingIndicator />}

          {(isProcessing || hasInitialMessage) && (
            <ProcessingIndicator isResponding={isResponding} />
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
        </>
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
    prevProps.singleLineReviewActions === nextProps.singleLineReviewActions
  );
});

export default ChatBody;
