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
}

// Hooks
import { useCollapseSections } from "./hooks/useCollapseSections";
import { useToolActions } from "./hooks/useToolActions";
import { useScrollBehavior } from "./hooks/useScrollBehavior";

import WelcomeUI from "../../HomePanel/WelcomeUI";
import ProcessingIndicator from "./components/ProcessingIndicator";
import ScrollToBottomButton from "./components/ScrollToBottomButton";
import MessageBox from "./components/MessageBox";
import ProcessGroup from "./components/ProcessGroup";

const ChatBody: React.FC<ExtendedChatBodyProps> = ({
  messages,
  isProcessing,
  onSendToolRequest,
  onSendMessage, // eslint-disable-line @typescript-eslint/no-unused-vars

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
  const { clickedActions, handleToolClick, failedActions } = useToolActions({
    onSendToolRequest,
    onToolAction,
    parsedMessages,
    isProcessing,
  });
  const { isAtBottom, scrollToBottom } = useScrollBehavior(messagesEndRef, [
    messages,
    isProcessing,
  ]);

  // 🆕 Debug logging and filtering logic
  const visibleMessages = useMemo(() => {
    return messages.filter((message) => {
      if (message.uiHidden || message.isCancelled) {
        return false;
      }
      return true;
    });
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

  // Group consecutive auto-process messages (assistant-with-tools + hidden-user pairs)
  // into ProcessGroups. A group ends when an assistant message has NO tool actions.
  // NOTE: Run on full `messages` (not visibleMessages) so uiHidden user messages are visible to the algorithm.
  const renderItems = useMemo(() => {
    if (isProcessing) return null; // Don't group while still processing

    type RenderItem =
      | { kind: "single"; message: Message; index: number }
      | { kind: "group"; messages: Message[] };

    const items: RenderItem[] = [];
    // Use non-cancelled messages (but include uiHidden for grouping logic)
    const allNonCancelled = messages.filter(m => !m.isCancelled);
    console.log(`[ProcessGroup] Running grouping on ${allNonCancelled.length} messages (isProcessing=${isProcessing})`);
    let i = 0;

    while (i < allNonCancelled.length) {
      const msg = allNonCancelled[i];

      if (msg.role === "assistant") {
        const parsed = parsedMessages.find(pm => pm.id === msg.id)?.parsed;
        const hasTools = (parsed?.actions?.length || 0) > 0;

        if (hasTools) {
          const groupMsgs: Message[] = [msg];
          let j = i + 1;

          while (j < allNonCancelled.length) {
            const next = allNonCancelled[j];
            if (next.role === "user" && next.uiHidden) {
              groupMsgs.push(next);
              j++;
              continue;
            }
            if (next.role === "assistant") {
              const nextParsed = parsedMessages.find(pm => pm.id === next.id)?.parsed;
              const nextHasTools = (nextParsed?.actions?.length || 0) > 0;
              groupMsgs.push(next);
              j++;
              if (!nextHasTools) break;
              continue;
            }
            break;
          }

          const assistantCount = groupMsgs.filter(m => m.role === "assistant").length;
          console.log(`[ProcessGroup] candidate group: ${groupMsgs.length} msgs, ${assistantCount} assistants`, groupMsgs.map(m => `${m.role}(hidden=${m.uiHidden})`));
          if (assistantCount > 1) {
            // Separate the final markdown-only assistant from the group so it renders outside
            const lastMsg = groupMsgs[groupMsgs.length - 1];
            const lastParsed = parsedMessages.find(pm => pm.id === lastMsg.id)?.parsed;
            const lastHasTools = (lastParsed?.actions?.length || 0) > 0;

            let processGroupMsgs = groupMsgs;
            let finalMsg: Message | null = null;
            if (!lastHasTools && lastMsg.role === "assistant") {
              processGroupMsgs = groupMsgs.slice(0, -1);
              finalMsg = lastMsg;
            }

            console.log(`[ProcessGroup] ✅ Formed group with ${processGroupMsgs.filter(m=>m.role==="assistant").length} assistants${finalMsg ? " + 1 final markdown" : ""}`);
            items.push({ kind: "group", messages: processGroupMsgs });
            if (finalMsg) {
              items.push({ kind: "single", message: finalMsg, index: visibleMessages.indexOf(finalMsg) });
            }
            i = j;
            continue;
          } else {
            console.log(`[ProcessGroup] ❌ Not enough assistants, treating as single`);
          }
        }
      }

      // Only add as single if not uiHidden
      if (!msg.uiHidden) {
        items.push({ kind: "single", message: msg, index: visibleMessages.indexOf(msg) });
      }
      i++;
    }

    console.log(`[ProcessGroup] Result: ${items.filter(r => r.kind === "group").length} groups, ${items.filter(r => r.kind === "single").length} singles`);
    return items;
  }, [messages, parsedMessages, isProcessing]);

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
      {visibleMessages.length === 0 && !isProcessing && (
        <WelcomeUI onLoadConversation={onLoadConversation} />
      )}

      <div className="chat-timeline-wrapper">
        {(renderItems || visibleMessages.map((message, index) => ({ kind: "single" as const, message, index }))).map((item) => {
          if (item.kind === "group") {
            return (
              <ProcessGroup
                key={item.messages[0].id}
                messages={item.messages}
                parsedMap={parsedMap}
                clickedActions={clickedActions}
                failedActions={failedActions}
                onToolClick={handleToolClick}
                toolOutputs={toolOutputs}
                terminalStatus={terminalStatus}
                allMessages={messages}
                activeTerminalIds={activeTerminalIds}
                attachedTerminalIds={attachedTerminalIds}
                conversationId={conversationId}
                onSendMessage={onSendMessage}
                onSelectOption={onSelectOption}
                executionState={executionState}
                previousAssistantMessage={messages
                  .slice(0, messages.findIndex(m => m.id === item.messages[0].id))
                  .reverse()
                  .find(m => m.role === "assistant")}
              />
            );
          }

          const { message, index } = item;
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
            />
          );
        })}
      </div>

      {isProcessing && <ProcessingIndicator isResponding={isResponding} />}

      <div ref={messagesEndRef} />

      {!isAtBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  );
};

export default ChatBody;
