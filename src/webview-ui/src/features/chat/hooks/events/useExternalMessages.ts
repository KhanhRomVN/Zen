import { useEffect, useRef } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";

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
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "loadProjectContext" });
    }

    const handleMessage = (event: MessageEvent) => {
      messageCountRef.current += 1;

      const message = event.data;

      if (message.command === "projectContextResponse") {
        setProjectContextRef.current(message.context);
      } else if (message.command === "addAttachedItem") {
        attachCountRef.current += 1;

        addAttachedItemRef.current({
          id: Math.random().toString(36).substring(7),
          path: message.uri,
          type: "file",
        });
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);
};