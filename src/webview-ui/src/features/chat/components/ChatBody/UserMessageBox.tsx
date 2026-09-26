import React from "react";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import { Message, QuestionAnswer } from "@/features/chat/types/message";
import RevertConfirmDrawer from "./RevertConfirmDrawer";

interface UserMessageBoxProps {
  message: Message;
  conversationId?: string;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  onRegenerateRequest?: (messageId: string) => void;
  onEditRequest?: (messageId: string, newContent: string, revert: boolean) => void;
}

/**
 * Parse <question-answer> tag from user message content
 * Returns: { answers: Record<string, string>, cleanedContent: string }
 */
const parseQuestionAnswerFromContent = (
  content: string,
): { answers: Record<string, string>; cleanedContent: string } => {
  const regex = /<question-answer>([\s\S]*?)<\/question-answer>/i;
  const match = regex.exec(content);

  if (!match) {
    return { answers: {}, cleanedContent: content };
  }

  const innerContent = match[1].trim();
  const answers: Record<string, string> = {};

  const lines = innerContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const lineMatch = /^(\d+)\.\s*(.*)$/i.exec(trimmed);
    if (!lineMatch) continue;
    const questionNumber = lineMatch[1];
    const answerText = lineMatch[2].trim();
    answers[`q${questionNumber}`] = answerText || "(no answer)";
  }

  const cleanedContent = content.replace(regex, "").trim();
  return { answers, cleanedContent };
};

// ─── Icons ───────────────────────────────────────────────────────────────────

const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const UserMessageBox: React.FC<UserMessageBoxProps> = ({
  message,
  conversationId,
  onRevertConversation,
  onRegenerateRequest,
  onEditRequest,
}) => {
  const [isCopied, setIsCopied] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const [showRevertModal, setShowRevertModal] = React.useState(false);
  const [pendingSendEdit, setPendingSendEdit] = React.useState<{ content: string } | null>(null);
  const [showRevertModal_forEdit, setShowRevertModal_forEdit] = React.useState(false);
  // true khi đang query revert preview để hiện loading trên nút Send
  const [checkingRevert, setCheckingRevert] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const userMsgRegex =
    /## User Message\n<user-message>\n([\s\S]*?)\n<\/user-message>/;
  const match = message.content.match(userMsgRegex);

  if (!match && !message.content.includes("## User Message")) {
    return null;
  }

  let displayContent = match
    ? match[1]
    : message.content.replace(/^[\s\S]*?## User Message\n/, "");

  if (!match) {
    if (displayContent.startsWith("```") && displayContent.includes("```", 3)) {
      displayContent = displayContent.split("```")[1].trim();
    }
    displayContent = displayContent
      .replace(/^<user-message>\n?/, "")
      .replace(/\n?<\/user-message>[\s\S]*$/, "");
  }

  const { answers: questionAnswers, cleanedContent } =
    parseQuestionAnswerFromContent(displayContent);
  const hasQuestionAnswers = Object.keys(questionAnswers).length > 0;
  if (hasQuestionAnswers) {
    displayContent = cleanedContent;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  // Auto-resize textarea in edit mode
  React.useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (!el) return;
    const rafId = requestAnimationFrame(() => {
      el.style.height = "auto";
      const maxHeight = 240;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    });
    return () => cancelAnimationFrame(rafId);
  }, [editValue, isEditing]);

  const handleOpenEdit = () => {
    setEditValue(displayContent);
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }, 50);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSendEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed) return;

    const vscodeApi = (window as any).vscodeApi;

    // Nếu không có vscodeApi hoặc không có messageId, không thể query revert preview
    // → mở drawer như cũ để an toàn
    if (!vscodeApi || !message.id) {
      setPendingSendEdit({ content: trimmed });
      setShowRevertModal_forEdit(true);
      return;
    }

    // Query revert preview trước. Nếu không có file nào bị ảnh hưởng → send thẳng.
    // Nếu có file → mở drawer để user confirm.
    setCheckingRevert(true);

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.command === "revertPreviewResult" && data?.messageId === message.id) {
        window.removeEventListener("message", handler);
        clearTimeout(timeoutId);
        setCheckingRevert(false);

        const hasFiles = Array.isArray(data.files) && data.files.length > 0;
        if (hasFiles) {
          // Có file bị ảnh hưởng → cần confirm qua drawer
          setPendingSendEdit({ content: trimmed });
          setShowRevertModal_forEdit(true);
        } else {
          // Không có revert nào → send ngay, không qua drawer
          if (onEditRequest) {
            onEditRequest(message.id, trimmed, false);
          } else if (onRegenerateRequest) {
            onRegenerateRequest(message.id);
          }
          setIsEditing(false);
        }
      }
    };

    window.addEventListener("message", handler);
    vscodeApi.postMessage({ command: "getRevertPreview", conversationId, messageId: message.id });

    // Timeout 3s: nếu không nhận được kết quả → fallback mở drawer
    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      setCheckingRevert(false);
      setPendingSendEdit({ content: trimmed });
      setShowRevertModal_forEdit(true);
    }, 3000);
  };

  const handleConfirmSendEdit = () => {
    if (!pendingSendEdit) return;
    if (onEditRequest) {
      onEditRequest(message.id, pendingSendEdit.content, true);
    } else if (onRegenerateRequest) {
      onRegenerateRequest(message.id);
    }
    setPendingSendEdit(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      className="user-message-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0px",
        marginBottom: "var(--spacing-md)",
        opacity: message.isCancelled ? 0.4 : 1,
        filter: message.isCancelled ? "grayscale(1) blur(0.5px)" : "none",
        pointerEvents: message.isCancelled ? "none" : "auto",
        transition: "all 0.3s ease",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Files Preview */}
      {message.uploadedFiles?.length || message.attachedItems?.length ? (
        <div style={{ marginBottom: "var(--spacing-xs)" }}>
          <FilesPreviews
            uploadedFiles={message.uploadedFiles || []}
            attachedItems={message.attachedItems || []}
            onRemoveFile={() => {}}
            onRemoveAttachedItem={() => {}}
            onOpenImage={(file) => {
              const vscodeApi = (window as any).vscodeApi;
              if (vscodeApi) {
                vscodeApi.postMessage({
                  command: "openTempImage",
                  content: file.content,
                  filename: file.name,
                });
              }
            }}
            onAttachedItemClick={() => {}}
            readOnly={true}
          />
        </div>
      ) : null}

      {/* Message bubble — ẩn khi đang edit, thay bằng edit box */}
      {!isEditing ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            backgroundColor: "var(--input-bg)",
            border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            padding: "var(--spacing-md)",
            marginLeft: "0px",
            position: "relative",
          }}
        >
          {/* Question Answers Summary */}
          {hasQuestionAnswers && (
            <div
              style={{
                marginBottom: "var(--spacing-sm)",
                padding: "var(--spacing-sm)",
                borderRadius: "4px",
                backgroundColor:
                  "color-mix(in srgb, var(--vscode-button-background) 10%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--vscode-button-background) 20%, transparent)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--vscode-descriptionForeground)",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Question Answers
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Object.entries(questionAnswers).map(([qId, answer]) => {
                  const questionNumber = qId.replace("q", "");
                  return (
                    <div
                      key={qId}
                      style={{
                        fontSize: "12px",
                        color: "var(--vscode-foreground)",
                        lineHeight: 1.5,
                      }}
                    >
                      <span
                        style={{
                          color: "var(--vscode-button-background)",
                          fontWeight: 600,
                          marginRight: "6px",
                        }}
                      >
                        {questionNumber}.
                      </span>
                      <span
                        style={{
                          opacity: answer === "(no answer)" ? 0.5 : 1,
                          fontStyle: answer === "(no answer)" ? "italic" : "normal",
                        }}
                      >
                        {answer}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content */}
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              maxWidth: "100%",
              maxHeight: "400px",
              overflow: "auto",
            }}
          >
            {displayContent}
          </div>
        </div>
      ) : (
        /* Inline edit box — thay thế message bubble */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            borderRadius: "var(--border-radius)",
            backgroundColor: "var(--input-bg)",
            border: "none",
            backgroundImage: `repeating-linear-gradient(0deg, var(--vscode-descriptionForeground), var(--vscode-descriptionForeground) 5px, transparent 5px, transparent 9px), repeating-linear-gradient(90deg, var(--vscode-descriptionForeground), var(--vscode-descriptionForeground) 5px, transparent 5px, transparent 9px), repeating-linear-gradient(180deg, var(--vscode-descriptionForeground), var(--vscode-descriptionForeground) 5px, transparent 5px, transparent 9px), repeating-linear-gradient(270deg, var(--vscode-descriptionForeground), var(--vscode-descriptionForeground) 5px, transparent 5px, transparent 9px)`,
            backgroundSize: `1.5px 100%, 100% 1.5px, 1.5px 100%, 100% 1.5px`,
            backgroundPosition: `0 0, 0 0, 100% 0, 0 100%`,
            backgroundRepeat: `no-repeat`,
            opacity: 1,
            padding: "10px 12px",
            position: "relative",
          }}
        >
          <style>{`
            .zen-edit-textarea {
              scrollbar-width: thin;
              scrollbar-color: var(--scrollbar-thumb, rgba(255,255,255,0.2)) transparent;
            }
            .zen-edit-textarea::-webkit-scrollbar {
              width: 8px;
            }
            .zen-edit-textarea::-webkit-scrollbar-track {
              background: transparent;
              border-radius: 10px;
              margin: 4px 0;
            }
            .zen-edit-textarea::-webkit-scrollbar-thumb {
              background-color: var(--scrollbar-thumb, rgba(255,255,255,0.2));
              border-radius: 10px;
              border: 2px solid transparent;
              background-clip: padding-box;
              min-height: 40px;
            }
            .zen-edit-textarea::-webkit-scrollbar-thumb:hover {
              background-color: var(--scrollbar-thumb-hover, rgba(255,255,255,0.35));
            }
          `}</style>
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="zen-edit-textarea"
            style={{
              width: "100%",
              minHeight: "24px",
              maxHeight: "240px",
              resize: "none",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--vscode-editor-foreground)",
              fontFamily: "inherit",
              fontSize: "var(--font-size-sm)",
              lineHeight: 1.6,
              padding: "0",
              boxSizing: "border-box",
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              justifyContent: "flex-end",
            }}
          >
            {/* Cancel — soft style */}
            <button
              onClick={handleCancelEdit}
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer",
                background: "color-mix(in srgb, var(--vscode-foreground) 8%, transparent)",
                border: "none",
                color: "var(--vscode-foreground)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "color-mix(in srgb, var(--vscode-foreground) 14%, transparent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  "color-mix(in srgb, var(--vscode-foreground) 8%, transparent)")
              }
            >
              Cancel
            </button>

            {/* Send — soft style */}
            <button
              onClick={handleSendEdit}
              disabled={!editValue.trim() || checkingRevert}
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: editValue.trim() && !checkingRevert ? "pointer" : "not-allowed",
                background: editValue.trim() && !checkingRevert
                  ? "color-mix(in srgb, var(--vscode-button-background) 22%, transparent)"
                  : "color-mix(in srgb, var(--vscode-button-background) 10%, transparent)",
                border: "none",
                color: editValue.trim() && !checkingRevert
                  ? "var(--vscode-button-background)"
                  : "color-mix(in srgb, var(--vscode-button-background) 40%, transparent)",
                fontWeight: 600,
                opacity: editValue.trim() && !checkingRevert ? 1 : 0.6,
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
              onMouseEnter={(e) => {
                if (editValue.trim() && !checkingRevert)
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--vscode-button-background) 30%, transparent)";
              }}
              onMouseLeave={(e) => {
                if (editValue.trim() && !checkingRevert)
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--vscode-button-background) 22%, transparent)";
              }}
            >
              {checkingRevert ? (
                <>
                  <svg
                    width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ animation: "umEditSpin 0.7s linear infinite" }}
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Checking…
                </>
              ) : "Send"}
              <style>{`@keyframes umEditSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </button>
          </div>
        </div>
      )}

      {/* Bottom toolbar */}
      {!isEditing && (
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "transparent",
            padding: "4px 8px",
          }}
        >
          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy content"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isCopied
                ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
                : "var(--vscode-descriptionForeground)",
              borderRadius: "4px",
              opacity: 0.7,
              transition: "opacity 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </button>

          {/* Edit (replaces regenerate) */}
          <button
            onClick={handleOpenEdit}
            title="Edit message"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--vscode-descriptionForeground)",
              borderRadius: "4px",
              opacity: 0.7,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            <EditIcon />
          </button>

          {/* Revert conversation to this point */}
          {onRevertConversation && (
            <button
              onClick={() => setShowRevertModal(true)}
              title="Revert conversation to this point"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--vscode-descriptionForeground)",
                borderRadius: "4px",
                opacity: 0.7,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
            </button>
          )}
        </div>
      )}

      <RevertConfirmDrawer
        isOpen={showRevertModal}
        onClose={() => setShowRevertModal(false)}
        messageId={message.id}
        conversationId={conversationId}
        onConfirm={() => {
          onRevertConversation!(message.id, message.timestamp);
        }}
      />

      {/* Drawer mở khi click Send trong edit mode */}
      <RevertConfirmDrawer
        isOpen={showRevertModal_forEdit}
        onClose={() => {
          setShowRevertModal_forEdit(false);
          setPendingSendEdit(null);
        }}
        messageId={message.id}
        conversationId={conversationId}
        onConfirm={handleConfirmSendEdit}
      />
    </div>
  );
};

export default UserMessageBox;
