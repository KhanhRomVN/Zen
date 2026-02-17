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
}

// Hooks
import { useCollapseSections } from "./hooks/useCollapseSections";
import { useToolActions } from "./hooks/useToolActions";
import { useScrollBehavior } from "./hooks/useScrollBehavior";

import WelcomeUI from "./components/WelcomeUI";
import ProcessingIndicator from "./components/ProcessingIndicator";
import ScrollToBottomButton from "./components/ScrollToBottomButton";
import MessageBox from "./components/MessageBox";

const ChatBody: React.FC<ExtendedChatBodyProps> = ({
  messages,
  isProcessing,
  onSendToolRequest,
  onSendMessage, // eslint-disable-line @typescript-eslint/no-unused-vars

  executionState,
  toolOutputs,
  firstRequestMessageId,
}: ExtendedChatBodyProps) => {
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
  const {
    clickedActions,
    handleToolClick,
    failedActions,
    clearedActions,
    handleActionClear,
  } = useToolActions({
    onSendToolRequest,

    parsedMessages,
  });
  const { isAtBottom, scrollToBottom } = useScrollBehavior(messagesEndRef, [
    messages,
    isProcessing,
  ]);

  // 🆕 Debug logging and filtering logic
  const visibleMessages = useMemo(() => {
    return messages.filter((message) => {
      if (message.uiHidden) {
        return false;
      }
      return true;
    });
  }, [messages, firstRequestMessageId]);

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
      }}
    >
      {visibleMessages.length === 0 && !isProcessing && <WelcomeUI />}

      {visibleMessages.map((message, index) => {
        // Regular messages - Use memoized parsed content
        const parsedMessage = parsedMessages.find((pm) => pm.id === message.id);
        if (!parsedMessage) {
          console.warn(`[ChatBody] Parsed message not found for ${message.id}`);
          return null;
        }
        const parsedContent = parsedMessage.parsed;

        return (
          <MessageBox
            key={message.id}
            message={message}
            parsedContent={parsedContent}
            isCollapsed={
              message.role === "user"
                ? collapsedSections.has(`prompt-${message.id}`)
                : collapsedSections.has(`thinking-${message.id}`)
            }
            onToggleCollapse={() =>
              toggleCollapse(
                message.role === "user"
                  ? `prompt-${message.id}`
                  : `thinking-${message.id}`,
              )
            }
            clickedActions={clickedActions}
            failedActions={failedActions}
            onToolClick={handleToolClick}
            executionState={executionState}
            isLastMessage={index === visibleMessages.length - 1} // Pass isLastMessage
            clearedActions={clearedActions}
            onActionClear={handleActionClear}
            toolOutputs={toolOutputs}
          />
        );
      })}

      {isProcessing && <ProcessingIndicator />}

      <div ref={messagesEndRef} />

      {!isAtBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  );
};

export default ChatBody;
