import { useCallback, useRef } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { extensionService } from "../../../../services/ExtensionService";
import { saveConversation } from "../../services/ConversationService";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useMessageHandlers');

interface UseMessageHandlersProps {
  message: string;
  setMessage: (value: string) => void;
  uploadedFiles: any[];
  attachedItems: any[];
  invalidExternalFiles: any[];
  currentModelRef: React.MutableRefObject<any>;
  currentAccountRef: React.MutableRefObject<any>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  clearDraft: () => void;
  clearFiles: () => void;
  clearAttachedItems: () => void;
  clearInvalidExternalFiles: () => void;
  undoStackRef: React.MutableRefObject<any[]>;
  undoIndexRef: React.MutableRefObject<number>;
  wrappedSendMessage: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipFirstRequestLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
  ) => Promise<void>;
  currentConversationId: string | null;
  currentChat: ChatSession | null;
  stopGeneration: () => void;
  setIsProcessing: (value: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isStoppedRef: React.MutableRefObject<boolean>;
}

/**
 * Hook to manage message sending and stopping handlers
 */
export const useMessageHandlers = ({
  message,
  setMessage,
  uploadedFiles,
  attachedItems,
  invalidExternalFiles,
  currentModelRef,
  currentAccountRef,
  textareaRef,
  clearDraft,
  clearFiles,
  clearAttachedItems,
  clearInvalidExternalFiles,
  undoStackRef,
  undoIndexRef,
  wrappedSendMessage,
  currentConversationId,
  currentChat,
  stopGeneration,
  setIsProcessing,
  setMessages,
  isStoppedRef,
}: UseMessageHandlersProps) => {
  const renderCountRef = useRef(0);
  const sendCountRef = useRef(0);
  const stopCountRef = useRef(0);
  
  renderCountRef.current += 1;

  log.render('useMessageHandlers', {
    renderCount: renderCountRef.current,
    messageLength: message.length,
    uploadedFilesCount: uploadedFiles.length,
    attachedItemsCount: attachedItems.length,
    invalidFilesCount: invalidExternalFiles.length
  });

  const handleSend = useCallback(
    (model: any, account: any) => {
      const callStartTime = performance.now();
      sendCountRef.current += 1;
      
      log.state('handleSend_start', {
        sendCount: sendCountRef.current,
        messageLength: message.length,
        uploadedFiles: uploadedFiles.length,
        attachedItems: attachedItems.length,
        model: model?.id,
        account: account?.id
      });

      // Check for invalid external files before sending
      if (invalidExternalFiles && invalidExternalFiles.length > 0) {
        log.state('send_blocked_invalid_files', {
          invalidFilesCount: invalidExternalFiles.length,
          reasons: invalidExternalFiles.map((f: any) => f.reason)
        });
        
        const vscodeApi = (window as any).vscodeApi;
        const message = `Cannot send message due to invalid file(s):\n${invalidExternalFiles.map((f) => `• ${f.name}: ${f.reason}`).join("\n")}\n\nPlease remove these files and try again.`;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: "showError",
            message: message,
          });
        } else {
          alert(message);
        }
        return;
      }

      if (
        message.trim() ||
        uploadedFiles.length > 0 ||
        attachedItems.length > 0
      ) {
        // Use refs (not state) to get the latest model/account values.
        // This prevents stale closure: if the user changed model right before
        // pressing Send, the state update may not have propagated into this
        // callback yet, but the ref always reflects the latest value.
        const latestModel = model || currentModelRef.current;
        const latestAccount = account || currentAccountRef.current;
        
        log.state('send_execute', {
          model: latestModel?.id,
          account: latestAccount?.id,
          totalFiles: uploadedFiles.length + attachedItems.length
        });
        
        wrappedSendMessage(
          message,
          [...uploadedFiles, ...attachedItems],
          latestModel,
          latestAccount,
          undefined,
          undefined,
          undefined,
        );
        setMessage("");
        clearDraft();
        clearFiles();
        clearAttachedItems();
        clearInvalidExternalFiles();
        undoStackRef.current = [];
        undoIndexRef.current = -1;
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        
        log.perf('handleSend_complete', callStartTime, {
          sendCount: sendCountRef.current
        });
      } else {
        log.state('send_blocked_empty', {});
      }
    },
    [
      message,
      uploadedFiles,
      attachedItems,
      invalidExternalFiles,
      currentModelRef,
      currentAccountRef,
      wrappedSendMessage,
      setMessage,
      clearDraft,
      clearFiles,
      clearAttachedItems,
      clearInvalidExternalFiles,
      undoStackRef,
      undoIndexRef,
      textareaRef,
    ],
  );

  const handleStopGeneration = useCallback(() => {
    const callStartTime = performance.now();
    stopCountRef.current += 1;
    
    log.state('handleStopGeneration', {
      stopCount: stopCountRef.current
    });

    isStoppedRef.current = true;
    stopGeneration();
    setIsProcessing(false);
    setMessages((prev: any) => {
      const markStartTime = performance.now();
      
      const lastAssistantIdx = [...prev].reduceRight(
        (found, m, i) =>
          found === -1 && m.role === "assistant" && !m.isCancelled ? i : found,
        -1,
      );
      
      if (lastAssistantIdx === -1) {
        log.state('stop_no_assistant_message', {});
        return prev;
      }
      
      const updated = [...prev];
      updated[lastAssistantIdx] = {
        ...updated[lastAssistantIdx],
        isCancelled: true,
      };
      
      log.state('stop_mark_cancelled', {
        messageId: updated[lastAssistantIdx].id,
        messageIndex: lastAssistantIdx
      });
      
      const sessionId = currentChat?.sessionId || -1;
      const folderPath = currentChat?.folderPath || null;
      saveConversation(
        sessionId,
        folderPath,
        updated,
        currentConversationId ?? undefined,
        currentChat || undefined,
        true,
      );
      
      log.perf('stop_mark_cancelled_complete', markStartTime, {});
      return updated;
    });
    
    log.perf('handleStopGeneration_complete', callStartTime, {
      stopCount: stopCountRef.current
    });
  }, [
    stopGeneration,
    setIsProcessing,
    setMessages,
    currentChat,
    currentConversationId,
    isStoppedRef,
  ]);

  const handleClearChat = useCallback(() => {
    log.state('handleClearChat', {
      conversationId: currentConversationId
    });
    
    extensionService.postMessage({
      command: "confirmClearChat",
      conversationId: currentConversationId,
    });
  }, [currentConversationId]);

  return {
    handleSend,
    handleStopGeneration,
    handleClearChat,
  };
};
