import { useCallback, useRef, useEffect } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { extensionService } from "../../../../services/ExtensionService";
import { saveConversation } from "../../services/ConversationService";

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

  // 🚀 PERFORMANCE FIX: Use refs to avoid re-creating handleSend on every state change
  const messageRef = useRef(message);
  const uploadedFilesRef = useRef(uploadedFiles);
  const attachedItemsRef = useRef(attachedItems);
  const invalidExternalFilesRef = useRef(invalidExternalFiles);
  const wrappedSendMessageRef = useRef(wrappedSendMessage);
  const setMessageRef = useRef(setMessage);
  const clearDraftRef = useRef(clearDraft);
  const clearFilesRef = useRef(clearFiles);
  const clearAttachedItemsRef = useRef(clearAttachedItems);
  const clearInvalidExternalFilesRef = useRef(clearInvalidExternalFiles);

  // Sync refs with state — all deps go through refs, handleSend stays stable
  useEffect(() => {
    messageRef.current = message;
    uploadedFilesRef.current = uploadedFiles;
    attachedItemsRef.current = attachedItems;
    invalidExternalFilesRef.current = invalidExternalFiles;
    wrappedSendMessageRef.current = wrappedSendMessage;
    setMessageRef.current = setMessage;
    clearDraftRef.current = clearDraft;
    clearFilesRef.current = clearFiles;
    clearAttachedItemsRef.current = clearAttachedItems;
    clearInvalidExternalFilesRef.current = clearInvalidExternalFiles;
  }, [
    message,
    uploadedFiles,
    attachedItems,
    invalidExternalFiles,
    wrappedSendMessage,
    setMessage,
    clearDraft,
    clearFiles,
    clearAttachedItems,
    clearInvalidExternalFiles,
  ]);

  renderCountRef.current += 1;

  const handleSend = useCallback(
    (model: any, account: any) => {
      const callStartTime = performance.now();
      sendCountRef.current += 1;

      // 🚀 PERF: Read from refs instead of closure
      const currentMessage = messageRef.current;
      const currentFiles = uploadedFilesRef.current;
      const currentItems = attachedItemsRef.current;
      const currentInvalidFiles = invalidExternalFilesRef.current;

      // Check for invalid external files before sending
      if (currentInvalidFiles && currentInvalidFiles.length > 0) {
        const vscodeApi = (window as any).vscodeApi;
        const message = `Cannot send message due to invalid file(s):\n${currentInvalidFiles.map((f) => `• ${f.name}: ${f.reason}`).join("\n")}\n\nPlease remove these files and try again.`;
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
        currentMessage.trim() ||
        currentFiles.length > 0 ||
        currentItems.length > 0
      ) {
        // Filter out images with errors before sending
        const validFiles = currentFiles.filter((file: any) => !file.error);
        const errorFiles = currentFiles.filter((file: any) => file.error);

        // Log filtered files
        if (errorFiles.length > 0) {
        }

        // Use refs (not state) to get the latest model/account values.
        // This prevents stale closure: if the user changed model right before
        // pressing Send, the state update may not have propagated into this
        // callback yet, but the ref always reflects the latest value.
        const latestModel = model || currentModelRef.current;
        const latestAccount = account || currentAccountRef.current;

        wrappedSendMessageRef.current(
          currentMessage,
          [...validFiles, ...currentItems],
          latestModel,
          latestAccount,
          undefined,
          undefined,
          undefined,
        );
        setMessageRef.current("");
        clearDraftRef.current();
        clearFilesRef.current();
        clearAttachedItemsRef.current();
        clearInvalidExternalFilesRef.current();
        undoStackRef.current = [];
        undoIndexRef.current = -1;
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    },
    [
      // 🚀 PERF: ALL deps via refs — handleSend is now PERMANENTLY STABLE
      currentModelRef,
      currentAccountRef,
      undoStackRef,
      undoIndexRef,
      textareaRef,
    ],
  );

  const handleStopGeneration = useCallback(() => {
    const callStartTime = performance.now();
    stopCountRef.current += 1;

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
        return prev;
      }

      const updated = [...prev];
      updated[lastAssistantIdx] = {
        ...updated[lastAssistantIdx],
        isCancelled: true,
      };

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

      return updated;
    });
  }, [
    stopGeneration,
    setIsProcessing,
    setMessages,
    currentChat,
    currentConversationId,
    isStoppedRef,
  ]);

  return {
    handleSend,
    handleStopGeneration,
  };
};
