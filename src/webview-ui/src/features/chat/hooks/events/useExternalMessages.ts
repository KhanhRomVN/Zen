import { useEffect, useRef } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { saveConversation } from "../../services/ConversationService";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useExternalMessages');

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
  const renderCountRef = useRef(0);
  const messageCountRef = useRef(0);
  const attachCountRef = useRef(0);
  const compressionCountRef = useRef(0);
  
  renderCountRef.current += 1;

  log.render('useExternalMessages', {
    renderCount: renderCountRef.current,
    messagesCount: messages.length,
    conversationId: currentConversationId
  });

  useEffect(() => {
    const setupStartTime = performance.now();
    
    log.state('external_messages_setup', {});

    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      log.state('load_project_context', {});
      vscodeApi.postMessage({ command: "loadProjectContext" });
    }

    const handleMessage = (event: MessageEvent) => {
      const eventStartTime = performance.now();
      messageCountRef.current += 1;
      
      const message = event.data;

      log.state('external_message_received', {
        messageCount: messageCountRef.current,
        command: message.command
      });

      if (message.command === "projectContextResponse") {
        log.state('project_context_received', {
          hasContext: !!message.context
        });
        setProjectContext(message.context);
      } else if (message.command === "addAttachedItem") {
        attachCountRef.current += 1;
        
        const isFolder =
          message.itemType === "folder" ||
          (!message.uri.includes(".") && !message.itemType);
        
        log.state('add_attached_item', {
          attachCount: attachCountRef.current,
          uri: message.uri,
          type: isFolder ? 'folder' : 'file'
        });
        
        addAttachedItem({
          id: Math.random().toString(36).substring(7),
          path: message.uri,
          type: isFolder ? "folder" : "file",
        });
      } else if (message.command === "createConversationWithSummary") {
        compressionCountRef.current += 1;
        
        const summary = message.summary;
        
        log.state('create_conversation_with_summary', {
          compressionCount: compressionCountRef.current,
          hasSummary: !!summary,
          summaryLength: summary?.length || 0
        });
        
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

          log.state('summary_message_created', {
            messageId: summaryMessage.id,
            contentLength: summaryMessage.content.length
          });

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

          log.state('summary_saved', {});
        }
      }
      
      log.perf('handleMessage', eventStartTime, {
        command: message.command,
        messageCount: messageCountRef.current
      });
    };

    window.addEventListener("message", handleMessage);
    
    log.perf('external_messages_setup_complete', setupStartTime, {});
    
    return () => {
      log.state('external_messages_cleanup', {
        totalMessages: messageCountRef.current,
        attachments: attachCountRef.current,
        compressions: compressionCountRef.current
      });
      window.removeEventListener("message", handleMessage);
    };
  }, [
    currentChat,
    currentConversationId,
    messages,
    setMessages,
    setProjectContext,
    addAttachedItem,
  ]);
};
