import { useEffect } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { saveConversation } from "../../services/ConversationService";

interface UseMessageHandlersProps {
  selectedTab: ChatSession | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentConversationIdRef: React.MutableRefObject<string>;
  backendConversationIdRef: React.MutableRefObject<string>;
}

export const useMessageHandlers = ({
  selectedTab,
  setMessages,
  currentConversationIdRef,
  backendConversationIdRef,
}: UseMessageHandlersProps) => {
  useEffect(() => {
    let handlerCallCount = 0;

    const handleMessage = (event: MessageEvent) => {
      handlerCallCount++;
      const { command, actionId } = event.data;

      if (
        (command === "markActionClicked" || command === "markActionFailed") &&
        actionId
      ) {
        const messageId = actionId.split("-action-")[0];
        if (messageId) {
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id === messageId) {
                const currentClicked = m.clickedActions || [];
                if (!currentClicked.includes(actionId)) {
                  return {
                    ...m,
                    clickedActions: [...currentClicked, actionId],
                  };
                }
              }
              return m;
            });

            // Persist the changes
            const sessionId = selectedTab?.sessionId || -1;
            const folderPath = selectedTab?.folderPath || null;
            saveConversation(
              sessionId,
              folderPath,
              updated,
              currentConversationIdRef.current,
              selectedTab || undefined,
              true, // skipTimestampUpdate
              undefined,
              backendConversationIdRef.current,
            );

            return updated;
          });
        }
      }

      if (command === "markActionRejected" && actionId) {
        const messageId = actionId.split("-action-")[0];
        if (messageId) {
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id === messageId) {
                const currentRejected = m.rejectedActions || [];
                if (!currentRejected.includes(actionId)) {
                  return {
                    ...m,
                    rejectedActions: [...currentRejected, actionId],
                  };
                }
              }
              return m;
            });

            const sessionId = selectedTab?.sessionId || -1;
            const folderPath = selectedTab?.folderPath || null;
            saveConversation(
              sessionId,
              folderPath,
              updated,
              currentConversationIdRef.current,
              selectedTab || undefined,
              true,
              undefined,
              backendConversationIdRef.current,
            );

            return updated;
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    selectedTab,
    setMessages,
    currentConversationIdRef,
    backendConversationIdRef,
  ]);
};
