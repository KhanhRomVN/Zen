import { useEffect } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { saveConversation } from "../../services/ConversationService";

interface UseExternalMessagesProps {
  currentChat: ChatSession | null;
  currentConversationId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setProjectContext: (context: any) => void;
  addAttachedItem: (item: any) => void;
}

/**
 * Hook to handle external messages from VSCode extension
 */
export const useExternalMessages = ({
  currentChat,
  currentConversationId,
  messages,
  setMessages,
  setProjectContext,
  addAttachedItem,
}: UseExternalMessagesProps) => {
  useEffect(() => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "loadProjectContext" });
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "projectContextResponse") {
        setProjectContext(message.context);
      } else if (message.command === "addAttachedItem") {
        const isFolder =
          message.itemType === "folder" ||
          (!message.uri.includes(".") && !message.itemType);
        addAttachedItem({
          id: Math.random().toString(36).substring(7),
          path: message.uri,
          type: isFolder ? "folder" : "file",
        });
      } else if (message.command === "createConversationWithSummary") {
        // Context Compression Flow:
        // 1. User clicks "Accept" in ContextCompressionBlock
        // 2. Creates hidden summary message (uiHidden: true) as context
        // 3. Saves conversation with summary
        // 4. Waits for user to send next message
        // 5. When user sends message, hidden summary is included in API context automatically
        //    (useChatLLM.ts only filters isError messages, not uiHidden messages)
        const summary = message.summary;
        if (summary) {
          // Create summary message as hidden context
          const summaryMessage: Message = {
            id: `summary-${Date.now()}`,
            role: "user",
            content: `Context from previous conversation (auto-compressed due to exceeding 100K tokens):\n\n${summary}`,
            timestamp: Date.now(),
            conversationId: currentConversationId || "",
            token_usage: 0,
            uiHidden: true, // Hide from UI but keep in context
          };

          // Add summary message to conversation
          setMessages((prev) => [...prev, summaryMessage]);

          // Save conversation with new summary context
          const sessionId = currentChat?.sessionId || -1;
          const folderPath = currentChat?.folderPath || null;
          saveConversation(
            sessionId,
            folderPath,
            [...messages, summaryMessage],
            currentConversationId ?? undefined,
            currentChat || undefined,
            true,
          );

          // Don't auto-send empty message - wait for user input
          // The hidden summary will be included in context when user sends next message
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    currentChat,
    currentConversationId,
    messages,
    setMessages,
    setProjectContext,
    addAttachedItem,
  ]);
};
