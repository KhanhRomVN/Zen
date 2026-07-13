import { useCallback, useRef } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { saveConversation } from "../../services/ConversationService";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useModelSwitch');

interface UseModelSwitchProps {
  messages: Message[];
  currentConversationId: string | null;
  currentChat: ChatSession | null;
  providers: any[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/**
 * Hook to manage model switching functionality
 */
export const useModelSwitch = ({
  messages,
  currentConversationId,
  currentChat,
  providers,
  setMessages,
}: UseModelSwitchProps) => {
  const renderCountRef = useRef(0);
  const switchCountRef = useRef(0);
  
  renderCountRef.current += 1;

  log.render('useModelSwitch', {
    renderCount: renderCountRef.current,
    messagesCount: messages.length,
    providersCount: providers.length
  });

  const handleModelSwitch = useCallback(
    (
      newModel: any,
      newAccount: any,
      contextData: {
        fileChanges: Array<{
          path: string;
          additions: number;
          deletions: number;
        }>;
        userMessages: Array<{ content: string; responseNumber: number }>;
      },
    ) => {
      const callStartTime = performance.now();
      switchCountRef.current += 1;
      
      log.state('handleModelSwitch_start', {
        switchCount: switchCountRef.current,
        newModel: newModel?.id,
        newAccount: newAccount?.email,
        providerId: newModel?.providerId,
        fileChanges: contextData.fileChanges.length
      });

      // Extract user messages from current range
      const currentRange = messages.reduce(
        (acc, msg, idx) => {
          if (msg.role === "user" && !msg.uiHidden) {
            acc.push({
              content: msg.content,
              index: idx,
            });
          }
          return acc;
        },
        [] as Array<{ content: string; index: number }>,
      );

      // Get last few user messages (e.g., last 3)
      const recentUserMessages = currentRange.slice(-3).map((m, i) => ({
        content: m.content,
        responseNumber: currentRange.length - 3 + i + 1,
      }));

      log.state('model_switch_extract_messages', {
        totalUserMessages: currentRange.length,
        recentMessages: recentUserMessages.length
      });

      // Update contextData with user messages
      contextData.userMessages = recentUserMessages;

      // Create ModelUsageInfo message as a system message
      const modelSwitchMessage: Message = {
        id: `model-switch-${Date.now()}`,
        role: "system" as const,
        content: `__MODEL_SWITCH__::${JSON.stringify({
          providerId: newModel.providerId,
          modelId: newModel.id,
          email: newAccount.email,
          websiteUrl: providers.find(
            (p: any) => p.provider_id === newModel.providerId,
          )?.website,
        })}`,
        timestamp: Date.now(),
        conversationId: currentConversationId || "",
        token_usage: 0,
      };

      log.state('model_switch_create_message', {
        messageId: modelSwitchMessage.id,
        providerId: newModel.providerId,
        modelId: newModel.id
      });

      // Add to messages
      setMessages((prev: Message[]) => [...prev, modelSwitchMessage]);

      // Save conversation with new model switch message
      const sessionId = currentChat?.sessionId || -1;
      const folderPath = currentChat?.folderPath || null;
      saveConversation(
        sessionId,
        folderPath,
        [...messages, modelSwitchMessage],
        currentConversationId ?? undefined,
        currentChat || undefined,
        true,
      );
      
      log.perf('handleModelSwitch_complete', callStartTime, {
        switchCount: switchCountRef.current
      });
    },
    [messages, currentConversationId, currentChat, providers, setMessages],
  );

  return { handleModelSwitch };
};
