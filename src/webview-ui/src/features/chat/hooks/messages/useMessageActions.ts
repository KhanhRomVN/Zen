import { useCallback } from "react";
import { Message } from "../../types/message";
import { useSettings } from "@/context/SettingsContext";

interface UseMessageActionsProps {
  messages: Message[];
  onSendMessage?: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
    extraOptions?: {
      user_action?: string;
      edit_message_id?: string;
      parent_message_id?: string;
    },
  ) => void | Promise<void>;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
}

export function useMessageActions({
  messages,
  onSendMessage,
  onRevertConversation,
}: UseMessageActionsProps) {
  const { permissionMode } = useSettings();

  /**
   * Regenerate a user message: revert to this message (removes it + everything
   * after) then resend its own rawRequest content unchanged.
   */
  const handleRegenerateRequest = useCallback(
    (messageId: string) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      const userMsg = messages[msgIndex];
      if (userMsg.role !== "user") return;
      if (!onSendMessage || !userMsg.rawRequest) return;

      // Extract original content from formatted rawRequest
      const userContentMatch = userMsg.rawRequest.match(
        /<user-message>\n?([\s\S]*?)\n?<\/user-message>/,
      );
      let contentToSend: string;
      let shouldSkipLogic: boolean;

      if (userContentMatch) {
        contentToSend = userContentMatch[1];
        shouldSkipLogic = false;
      } else {
        contentToSend = userMsg.rawRequest;
        shouldSkipLogic = true;
      }

      // Replace old permission mode with current mode
      const permissionModePattern =
        /<permission-mode>Active:\s*(approval|full-access|fullAccess)<\/permission-mode>/;
      if (!shouldSkipLogic && permissionModePattern.test(contentToSend)) {
        contentToSend = contentToSend.replace(
          permissionModePattern,
          `<permission-mode>Active: ${permissionMode}</permission-mode>`,
        );
      }

      // If we have Qwen provider fid + parentId, use edit flow (no revert needed —
      // Qwen will overwrite the message and delete children on the server side).
      if (userMsg.providerFid) {
        onSendMessage(
          contentToSend,
          userMsg.uploadedFiles,
          undefined,
          undefined,
          shouldSkipLogic,
          undefined,
          undefined,
          {
            user_action: "edit",
            edit_message_id: userMsg.providerFid,
            parent_message_id: userMsg.providerParentId,
          },
        );
        return;
      }

      // Fallback for providers without edit support: revert then resend
      if (onRevertConversation) {
        onRevertConversation(messageId, userMsg.timestamp);
      }
      setTimeout(() => {
        onSendMessage(
          contentToSend,
          userMsg.uploadedFiles,
          undefined,
          undefined,
          shouldSkipLogic,
        );
      }, 100);
    },
    [messages, onRevertConversation, onSendMessage, permissionMode],
  );

  /**
   * Edit a user message with new content (and optionally revert file changes).
   */
  const handleEditRequest = useCallback(
    (messageId: string, newContent: string, revert: boolean) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      const userMsg = messages[msgIndex];
      if (userMsg.role !== "user") return;
      if (!onSendMessage) return;

      // Replace permission mode in rawRequest template, then swap user-message content
      let rawTemplate = userMsg.rawRequest || "";
      const permissionModePattern =
        /<permission-mode>Active:\s*(approval|full-access|fullAccess)<\/permission-mode>/;
      if (permissionModePattern.test(rawTemplate)) {
        rawTemplate = rawTemplate.replace(
          permissionModePattern,
          `<permission-mode>Active: ${permissionMode}</permission-mode>`,
        );
      }

      // Determine skipLogic: if rawRequest has user-message wrapper, use full pipeline
      const hasWrapper = /<user-message>/.test(rawTemplate);
      const shouldSkipLogic = !hasWrapper;

      // If revert requested, do it first, then send after a short delay
      if (revert && onRevertConversation) {
        onRevertConversation(messageId, userMsg.timestamp);
        setTimeout(() => {
          onSendMessage(
            newContent,
            userMsg.uploadedFiles,
            undefined,
            undefined,
            shouldSkipLogic,
            undefined,
            undefined,
            userMsg.providerFid
              ? {
                  user_action: "edit",
                  edit_message_id: userMsg.providerFid,
                  parent_message_id: userMsg.providerParentId,
                }
              : undefined,
          );
        }, 100);
        return;
      }

      // No revert: use Qwen edit flow if available, otherwise just send
      if (userMsg.providerFid) {
        onSendMessage(
          newContent,
          userMsg.uploadedFiles,
          undefined,
          undefined,
          shouldSkipLogic,
          undefined,
          undefined,
          {
            user_action: "edit",
            edit_message_id: userMsg.providerFid,
            parent_message_id: userMsg.providerParentId,
          },
        );
        return;
      }

      // Fallback: revert anyway (no edit support without providerFid)
      if (onRevertConversation) {
        onRevertConversation(messageId, userMsg.timestamp);
      }
      setTimeout(() => {
        onSendMessage(
          newContent,
          userMsg.uploadedFiles,
          undefined,
          undefined,
          shouldSkipLogic,
        );
      }, 100);
    },
    [messages, onRevertConversation, onSendMessage, permissionMode],
  );

  /**
   * Retry an assistant message: find the preceding user message, revert to
   * the assistant message, then resend the user message.
   */
  const handleRetryRequest = useCallback(
    (messageId: string) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex <= 0) return;

      let prevUserMsg: Message | null = null;
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          prevUserMsg = messages[i];
          break;
        }
      }
      if (!prevUserMsg) return;

      const targetMessage = messages[msgIndex];

      // First revert to this message (removes all messages after)
      if (onRevertConversation) {
        onRevertConversation(messageId, targetMessage.timestamp);
      }

      if (onSendMessage && prevUserMsg.rawRequest) {
        setTimeout(() => {
          let rawReq = prevUserMsg!.rawRequest || "";

          // Replace old permission mode with current mode
          const permissionModePattern =
            /<permission-mode>Active:\s*(approval|full-access|fullAccess)<\/permission-mode>/;
          if (permissionModePattern.test(rawReq)) {
            rawReq = rawReq.replace(
              permissionModePattern,
              `<permission-mode>Active: ${permissionMode}</permission-mode>`,
            );
          }

          // Extract original content from formatted rawRequest
          const userContentMatch = rawReq.match(
            /<user-message>\n?([\s\S]*?)\n?<\/user-message>/,
          );
          let contentToSend: string;
          let shouldSkipLogic: boolean;

          if (userContentMatch) {
            contentToSend = userContentMatch[1];
            shouldSkipLogic = false;
          } else {
            contentToSend = rawReq;
            shouldSkipLogic = true;
          }

          onSendMessage(
            contentToSend,
            prevUserMsg!.uploadedFiles,
            undefined,
            undefined,
            shouldSkipLogic,
          );
        }, 100);
      }
    },
    [messages, onRevertConversation, onSendMessage, permissionMode],
  );

  return { handleRegenerateRequest, handleEditRequest, handleRetryRequest };
}
