import React, { useMemo, useRef, useEffect } from "react";
import {
  parseAIResponse,
  ParsedResponse,
} from "../../../services/ResponseParser";
import { Message, ChatBodyProps } from "./types";

interface ExtendedChatBodyProps extends ChatBodyProps {
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
  isSimpleMode?: boolean;
  isRestored?: boolean;
  onContinue?: () => void;
  hasInitialMessage?: boolean;
  onAutoScrollPausedChange?: (paused: boolean) => void;
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
}

// Hooks
import { useCollapseSections } from "./hooks/useCollapseSections";
import { useToolActions } from "./hooks/useToolActions";
import { useScrollBehavior } from "./hooks/useScrollBehavior";
import { useSettings } from "../../../context/SettingsContext";
import { getPermissionDecision } from "../../../hooks/useToolExecution";

import WelcomeUI from "../../HomePanel/WelcomeUI";
import ProcessingIndicator from "./components/ProcessingIndicator";
import ScrollToBottomButton from "./components/ScrollToBottomButton";
import MessageBox from "./components/MessageBox";

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
  isSimpleMode = true,
  isRestored = false,
  onContinue,
  hasInitialMessage = false,
  onRevertConversation,
  onAutoScrollPausedChange,
  scrollToBottomRef,
}: ExtendedChatBodyProps) => {
  const { permissionMode } = useSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Memoize parsed messages
  const parsedMessages = useMemo(() => {
    const cache = new Map<string, ParsedResponse>();

    const result = messages.map((msg) => {
      if (!cache.has(msg.content)) {
        cache.set(msg.content, parseAIResponse(msg.content));
      }

      return {
        ...msg,
        parsed: cache.get(msg.content)!,
      };
    });

    return result;
  }, [messages]);

  // Hooks
  const { collapsedSections, toggleCollapse, setInitiallyCollapsed } =
    useCollapseSections();
  const { clickedActions, handleToolClick, failedActions } = useToolActions({
    onSendToolRequest,
    onToolAction,
    parsedMessages,
    isProcessing,
    isRestored,
  });
  const { isAtBottom, autoScrollPaused, scrollToBottom } = useScrollBehavior(messagesEndRef, [
    messages,
    isProcessing,
  ]);

  // Notify parent of pause state changes
  const prevPausedRef = useRef(false);
  useEffect(() => {
    if (autoScrollPaused !== prevPausedRef.current) {
      prevPausedRef.current = autoScrollPaused;
      onAutoScrollPausedChange?.(autoScrollPaused);
    }
  }, [autoScrollPaused, onAutoScrollPausedChange]);

  // Expose scrollToBottom to parent
  useEffect(() => {
    if (scrollToBottomRef) scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom, scrollToBottomRef]);

  const hasUnexecutedAutoActions = useMemo(() => {
    if (!isRestored || messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    const parsed = parseAIResponse(lastMessage.content);
    if (!parsed.actions || parsed.actions.length === 0) return false;

    // Find the very first pending action in the list
    const firstPendingAction = parsed.actions.find((action: any, idx: number) => {
      if (action.isPartial) return false;
      const actionId = `${lastMessage.id}-action-${idx}`;
      const hasOutput = toolOutputs && toolOutputs[actionId];
      const isClicked = clickedActions.has(actionId);
      return !hasOutput && !isClicked;
    });

    if (!firstPendingAction) return false;

    // Determine if this first pending action is visible to the user
    const isVisible = !isSimpleMode || [
      "write_to_file",
      "replace_in_file",
      "run_command",
      "execute_agent_action"
    ].includes(firstPendingAction.type);

    // If it's visible, the user can interact with it directly via its 3 buttons,
    // so we don't need to show the "Continue Task" button.
    if (isVisible) return false;

    // If it's invisible, we show the "Continue Task" button ONLY if it is auto-runnable
    const decision = getPermissionDecision(permissionMode, firstPendingAction.type);
    return decision === "allow";
  }, [messages, isRestored, toolOutputs, permissionMode, clickedActions, isSimpleMode]);

  // 🆕 Debug logging and filtering logic
  const visibleMessages = useMemo(() => {
    const filtered = messages.filter((message) => {
      if (message.uiHidden || message.isCancelled) {
        return false;
      }
      return true;
    });
    return filtered;
  }, [messages, firstRequestMessageId]);

  // Find the index of the last assistant message (it might not be the literal last if followed by user input)
  // This ensures tools in that assistant block remain interactive.
  const lastAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [visibleMessages]);

  // Detect if assistant is currently streaming content
  const isResponding = useMemo(() => {
    if (!isProcessing || visibleMessages.length === 0) return false;
    const lastMessage = visibleMessages[visibleMessages.length - 1];
    if (lastMessage.role !== "assistant") return false;

    const parsedMessage = parsedMessages.find((pm) => pm.id === lastMessage.id);
    if (!parsedMessage) return false;

    const parsed = parsedMessage.parsed;
    // Check if there's any content being streamed
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
          case "html":
          case "file":
          case "markdown":
            return b.content.trim().length > 0;
          default:
            return false;
        }
      });

    return !!(hasText || hasActions || hasOtherBlocks);
  }, [isProcessing, visibleMessages, parsedMessages]);

  const parsedMap = useMemo(() => {
    const map = new Map<string, any>();
    parsedMessages.forEach(pm => map.set(pm.id, pm.parsed));
    return map;
  }, [parsedMessages]);

  return (
    <div
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
      }}
    >
      {visibleMessages.length === 0 && !isProcessing && !hasInitialMessage && (
        <WelcomeUI onLoadConversation={onLoadConversation} />
      )}

      <div className="chat-timeline-wrapper">
        {visibleMessages.map((message, index) => {
          const parsedMessage = parsedMessages.find((pm) => pm.id === message.id);
          if (!parsedMessage) return null;
          const parsedContent = parsedMessage.parsed;

          const nextUserMessage = messages
            .slice(messages.findIndex((m) => m.id === message.id) + 1)
            .find((m) => m.role === "user");

          const previousAssistantMessage = messages
            .slice(0, messages.findIndex((m) => m.id === message.id))
            .reverse()
            .find((m) => m.role === "assistant");

          return (
            <MessageBox
              key={message.id}
              message={message}
              parsedContent={parsedContent}
              nextUserMessage={nextUserMessage}
              isGenerating={isProcessing && index === visibleMessages.length - 1}
              isCollapsed={
                message.role === "user"
                  ? collapsedSections.has(`prompt-${message.id}`)
                  : false
              }
              onToggleCollapse={() => toggleCollapse(`prompt-${message.id}`)}
              clickedActions={clickedActions}
              failedActions={failedActions}
              onToolClick={handleToolClick}
              executionState={executionState}
              isLastMessage={
                index === visibleMessages.length - 1 ||
                index === lastAssistantIndex
              }
              toolOutputs={toolOutputs}
              terminalStatus={terminalStatus}
              allMessages={messages}
              activeTerminalIds={activeTerminalIds}
              attachedTerminalIds={attachedTerminalIds}
              conversationId={conversationId}
              previousAssistantMessage={previousAssistantMessage}
              onSendMessage={onSendMessage}
              onSelectOption={onSelectOption}
              isSimpleMode={isSimpleMode}
              onRevertConversation={onRevertConversation}
            />
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
              backgroundColor: "color-mix(in srgb, var(--vscode-button-background, #007acc) 15%, transparent)",
              color: "var(--vscode-button-background, #007acc)",
              border: "1px solid color-mix(in srgb, var(--vscode-button-background, #007acc) 30%, transparent)",
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

      {(isProcessing || hasInitialMessage) && <ProcessingIndicator isResponding={isResponding} />}

      <div ref={messagesEndRef} />

      {!isAtBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  );
};

export default ChatBody;
