import { useEffect, useRef } from "react";
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
 * 
 * PERFORMANCE: Uses refs to avoid recreating event listeners on every message change
 */
export const useExternalMessages = ({
  currentChat,
  currentConversationId,
  messages,
  setMessages,
  setProjectContext,
  addAttachedItem,
}: UseExternalMessagesProps) => {
  const renderCountRef = useRef(0);
  const messageCountRef = useRef(0);
  const attachCountRef = useRef(0);
  const compressionCountRef = useRef(0);

  renderCountRef.current += 1;

  // Use refs to access latest values without recreating listener
  const currentChatRef = useRef(currentChat);
  const currentConversationIdRef = useRef(currentConversationId);
  const messagesRef = useRef(messages);
  const setMessagesRef = useRef(setMessages);
  const setProjectContextRef = useRef(setProjectContext);
  const addAttachedItemRef = useRef(addAttachedItem);
  
  // Update refs when values change
  useEffect(() => {
    currentChatRef.current = currentChat;
    currentConversationIdRef.current = currentConversationId;
    messagesRef.current = messages;
    setMessagesRef.current = setMessages;
    setProjectContextRef.current = setProjectContext;
    addAttachedItemRef.current = addAttachedItem;
  }, [currentChat, currentConversationId, messages, setMessages, setProjectContext, addAttachedItem]);

  useEffect(() => {
    const setupStartTime = performance.now();

    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "loadProjectContext" });
    }

    const handleMessage = (event: MessageEvent) => {
      const eventStartTime = performance.now();
      messageCountRef.current += 1;

      const message = event.data;

      if (message.command === "projectContextResponse") {
        setProjectContextRef.current(message.context);
      } else if (message.command === "addAttachedItem") {
        attachCountRef.current += 1;

        const isFolder =
          message.itemType === "folder" ||
          (!message.uri.includes(".") && !message.itemType);

        addAttachedItemRef.current({
          id: Math.random().toString(36).substring(7),
          path: message.uri,
          type: isFolder ? "folder" : "file",
        });
      } else if (message.command === "createConversationWithSummary") {
        compressionCountRef.current += 1;

        const summary = message.summary;

        if (summary) {
          // Create summary message as hidden context
          const summaryMessage: Message = {
            id: `summary-${Date.now()}`,
            role: "user",
            content: `Context from previous conversation (auto-compressed due to exceeding 100K tokens):\n\n${summary}`,
            timestamp: Date.now(),
            conversationId: currentConversationIdRef.current || "",
            token_usage: 0,
            uiHidden: true, // Hide from UI but keep in context
          };

          // Add summary message to conversation
          setMessagesRef.current((prev) => [...prev, summaryMessage]);

          // Save conversation with new summary context
          const sessionId = currentChatRef.current?.sessionId || -1;
          const folderPath = currentChatRef.current?.folderPath || null;
          saveConversation(
            sessionId,
            folderPath,
            [...messagesRef.current, summaryMessage],
            currentConversationIdRef.current ?? undefined,
            currentChatRef.current || undefined,
            true,
          );
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []); // Empty deps - listener set up once, uses refs for latest values
};
