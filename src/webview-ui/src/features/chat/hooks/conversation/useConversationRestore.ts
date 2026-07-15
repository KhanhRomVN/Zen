import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "../../types/message";
import { ChatSession } from "../../types/chat";
import { ConversationCache } from "../../services/ConversationCache";
import { deleteConversation } from "../../services/ConversationService";
import { extensionService } from "@/services/ExtensionService";

interface UseConversationRestoreProps {
  currentChat: ChatSession | null;
  currentConversationId: string;
  currentConversationIdRef: React.MutableRefObject<string>;
  messagesRef: React.MutableRefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsProcessing: (val: boolean) => void;
  setToolOutputs: React.Dispatch<
    React.SetStateAction<
      Record<string, { output: string; isError: boolean; terminalId?: string }>
    >
  >;
  setBackendConversationId: (id: string, meta?: any) => void;
  setCurrentConversationId: (id: string) => void;
  setCurrentModel: (model: any) => void;
  setCurrentAccount: (account: any) => void;
  onBack: (contentToReturn?: string) => void;
  revertParentMessageIdRef: React.MutableRefObject<string | null>;
  setRevertInput: React.Dispatch<
    React.SetStateAction<{ value: string; nonce: number } | null>
  >;
  setLoadedConversationFileStats: React.Dispatch<
    React.SetStateAction<{
      totalFiles: number;
      totalAdditions: number;
      totalDeletions: number;
    } | null>
  >;
}

export const useConversationRestore = ({
  currentChat,
  currentConversationId,
  currentConversationIdRef,
  messagesRef,
  setMessages,
  setIsProcessing,
  setToolOutputs,
  setBackendConversationId,
  setCurrentConversationId,
  setCurrentModel,
  setCurrentAccount,
  onBack,
  revertParentMessageIdRef,
  setRevertInput,
  setLoadedConversationFileStats,
}: UseConversationRestoreProps) => {
  const [isLoadingConversation, setIsLoadingConversation] =
    useState<boolean>(true);
  const [isRestored, setIsRestored] = useState<boolean>(false);
  const revertMessageIdRef = useRef<string | null>(null);

  // Load conversation
  useEffect(() => {
    const load = async () => {
      if (!currentChat) {
        if (currentConversationIdRef.current) {
          return;
        }
        setMessages([]);
        setIsLoadingConversation(false);
        setIsProcessing(false);
        setIsRestored(false);
        return;
      }
      setIsLoadingConversation(true);
      setIsRestored(false);
      const convId = (currentChat as any).conversationId;
      if (convId) {
        const cached = ConversationCache.get(convId);
        if (cached) {
          // Restore messages from cache
          const messagesToRestore = cached.messages;
          setMessages(messagesToRestore);
          if (
            cached.toolOutputs &&
            Object.keys(cached.toolOutputs).length > 0
          ) {
            setToolOutputs(cached.toolOutputs);
          }
          if (
            cached.singleLineReviewActions &&
            Object.keys(cached.singleLineReviewActions).length > 0
          ) {
            window.postMessage(
              {
                command: "restoreSingleLineReviewActions",
                actions: cached.singleLineReviewActions,
              },
              "*",
            );
          }
          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${convId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;
          setIsRestored(cached.messages.length > 0);
          currentConversationIdRef.current = cached.conversationId;
          setCurrentConversationId(cached.conversationId);
          if (cached.backendConversationId) {
            setBackendConversationId(cached.backendConversationId);
          }
          if (cached.currentModel) {
            setCurrentModel(cached.currentModel);
          }
          if (cached.currentAccount) {
            setCurrentAccount(cached.currentAccount);
          }
          setIsLoadingConversation(false);
          return;
        }

        const requestId = `conv-${Date.now()}`;
        extensionService.postMessage({
          command: "getConversation",
          conversationId: convId,
          requestId,
        });
      } else {
        setMessages([]);
        setCurrentConversationId("");
        setIsLoadingConversation(false);
      }
    };
    load();
  }, [currentChat?.sessionId, (currentChat as any)?.conversationId]);

  // Handle incoming messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.command === "conversationResult") {
        if (data.data?.messages) {
          const restoredMessages = data.data.messages.map(
            (msg: Message, i: number) => ({
              ...msg,
              id: msg.id || `restored-${Date.now()}-${i}`,
            }),
          );

          setMessages(restoredMessages);

          if (
            data.data.toolOutputs &&
            Object.keys(data.data.toolOutputs).length > 0
          ) {
            setToolOutputs(data.data.toolOutputs);
          }

          if (
            data.data.singleLineReviewActions &&
            Object.keys(data.data.singleLineReviewActions).length > 0
          ) {
            window.postMessage(
              {
                command: "restoreSingleLineReviewActions",
                actions: data.data.singleLineReviewActions,
              },
              "*",
            );
          }

          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${data.data?.conversationId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;

          if (data.data.messages.length > 0) {
            setIsRestored(true);
          }
          if (data.data.conversationId) {
            currentConversationIdRef.current = data.data.conversationId;
            setCurrentConversationId(data.data.conversationId);

            const lastMsgWithBackendId = [...restoredMessages]
              .reverse()
              .find((m: Message) => m.conversationId);
            const backendIdFromMsg = lastMsgWithBackendId?.conversationId;
            const lastAssistantWithMeta = [...restoredMessages]
              .reverse()
              .find(
                (m: Message) =>
                  m.role === "assistant" && m.providerId && m.modelId,
              );
            const restoredMeta = lastAssistantWithMeta
              ? {
                  providerId: lastAssistantWithMeta.providerId,
                  modelId: lastAssistantWithMeta.modelId,
                  accountId: lastAssistantWithMeta.accountId,
                }
              : undefined;
            const backendIdToUse =
              backendIdFromMsg ||
              data.data.backendConversationId ||
              data.data.conversationId;
            setBackendConversationId(backendIdToUse, restoredMeta);

            const lastAssistantMsgForMeta = [...restoredMessages]
              .reverse()
              .find(
                (m: Message) =>
                  m.role === "assistant" && m.providerId && m.modelId,
              );
            let modelToCache: any = undefined;
            let accountToCache: any = undefined;
            if (lastAssistantMsgForMeta) {
              modelToCache = {
                providerId: lastAssistantMsgForMeta.providerId!,
                id: lastAssistantMsgForMeta.modelId!,
                name: lastAssistantMsgForMeta.modelId!,
              };
              accountToCache = {
                id: lastAssistantMsgForMeta.accountId!,
                email: lastAssistantMsgForMeta.email!,
              };
              setCurrentModel(modelToCache);
              setCurrentAccount(accountToCache);
            }
            ConversationCache.set(data.data.conversationId, {
              messages: restoredMessages,
              conversationId: data.data.conversationId,
              backendConversationId: backendIdToUse,
              currentModel: modelToCache,
              currentAccount: accountToCache,
              toolOutputs: data.data.toolOutputs,
              singleLineReviewActions: data.data.singleLineReviewActions,
              conversationFileStats: data.data.conversationFileStats,
            });

            // Set loaded conversation file stats
            if (data.data.conversationFileStats) {
              setLoadedConversationFileStats(data.data.conversationFileStats);
            }
          }
        }
        setIsLoadingConversation(false);
        setIsProcessing(false);
      } else if (data.command === "commitError") {
        const errorMsg = data.error || "Unknown git error";
        const errorMessage: Message = {
          id: `msg-error-${Date.now()}`,
          role: "assistant",
          content: `❌ **Lỗi commit/push**\n\n\`\`\`\n${errorMsg}\n\`\`\``,
          timestamp: Date.now(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: "showError",
            message: `Lỗi commit/push: ${errorMsg.substring(0, 200)}${errorMsg.length > 200 ? "..." : ""}`,
          });
        }
      } else if (
        data.command === "clearChatConfirmed" &&
        data.conversationId === currentConversationId
      ) {
        handleClearConfirmed();
      } else if (
        data.command === "conversationRevertedError" &&
        data.conversationId === currentConversationId
      ) {
        console.error(
          "[REVERT-DEBUG] Received conversationRevertedError from extension:",
          data.error,
        );
        setIsLoadingConversation(false);
        revertMessageIdRef.current = null;
      } else if (
        data.command === "conversationReverted" &&
        data.conversationId === currentConversationId
      ) {
        const targetId = revertMessageIdRef.current;
        revertMessageIdRef.current = null;
        if (targetId === "__first__") {
          deleteConversation(currentConversationId);
          const firstUserMsg = messagesRef.current.find(
            (m) => !m.uiHidden && !m.isCancelled && m.role === "user",
          );
          let content = firstUserMsg?.content || "";
          const match = content.match(
            /<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
          );
          if (match) content = match[1];
          setMessages([]);
          setIsLoadingConversation(false);
          onBack(content);
        } else {
          setMessages((prev) => {
            const idx = targetId
              ? prev.findIndex((m) => m.id === targetId)
              : -1;
            if (idx === -1) return prev;
            const msg = prev[idx];
            const match = msg.content.match(
              /<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
            );
            const content = match ? match[1] : msg.content;
            const prevAssistant = [...prev.slice(0, idx)]
              .reverse()
              .find((m) => m.role === "assistant");
            revertParentMessageIdRef.current =
              prevAssistant?.response_message_id || null;
            if (revertParentMessageIdRef.current) {
              sessionStorage.setItem(
                `zen-revert-parent:${currentConversationId}`,
                revertParentMessageIdRef.current,
              );
            } else {
              sessionStorage.removeItem(
                `zen-revert-parent:${currentConversationId}`,
              );
            }
            setRevertInput({ value: content, nonce: Date.now() });
            const reverted = prev.slice(0, idx);
            const existing = ConversationCache.get(currentConversationId);
            ConversationCache.set(currentConversationId, {
              messages: reverted,
              conversationId: currentConversationId,
              backendConversationId: existing?.backendConversationId,
              currentModel: existing?.currentModel,
              currentAccount: existing?.currentAccount,
            });
            return reverted;
          });
          setIsLoadingConversation(false);
          setIsProcessing(false);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [currentConversationId]);

  const handleClearConfirmed = async () => {
    if (currentChat) {
      await deleteConversation(currentConversationId);
      setMessages([]);
      setIsProcessing(false);
      setCurrentConversationId(Date.now().toString());
    }
  };

  const handleRevertConversation = useCallback(
    (messageId: string, timestamp: number) => {
      if (!currentConversationId) {
        console.warn(
          "[REVERT-DEBUG] handleRevertConversation: no currentConversationId, aborting",
        );
        return;
      }
      const visibleUserMessages = messagesRef.current.filter(
        (m) => !m.uiHidden && !m.isCancelled && m.role === "user",
      );
      const isFirstMessage =
        visibleUserMessages.length > 0 &&
        visibleUserMessages[0].id === messageId;
      revertMessageIdRef.current = isFirstMessage ? "__first__" : messageId;
      setIsLoadingConversation(true);
      extensionService.postMessage({
        command: "revertConversation",
        conversationId: currentConversationId,
        messageId,
        timestamp,
      });
    },
    [currentConversationId, messagesRef],
  );

  return {
    isLoadingConversation,
    isRestored,
    setIsRestored: setIsRestored as React.Dispatch<
      React.SetStateAction<boolean>
    >,
    setIsLoadingConversation: setIsLoadingConversation as React.Dispatch<
      React.SetStateAction<boolean>
    >,
    handleRevertConversation,
    handleClearConfirmed,
    setRevertInput,
  };
};
