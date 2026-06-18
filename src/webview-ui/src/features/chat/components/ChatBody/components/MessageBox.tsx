import React from "react";
import { createPortal } from "react-dom";
import { Message } from "../../../types";
import { ParsedResponse } from "../../../services/ResponseParser";
import FollowupOptions from "./FollowupOptions";
import ToolActionsList from "./ToolActions/index";
import QuestionBlock from "./QuestionBlock";
import HtmlPreview from "./HtmlPreview";
import FileIcon from "./FileIcon";
import { isDiff, parseDiff } from "../../../../../utils/diffUtils";
import { ToolHeader } from "./ToolHeader";
import MarkdownWithPaths from "./MarkdownWithPaths";
import "./TerminalBlock.css";
import "./MarkdownContent.css";
import { buildRetryPrompt } from "../../../prompts";
import { useI18n } from "../../../../../hooks/useI18n";
import type { I18nKey } from "../../../../../i18n";

interface MessageBoxProps {
  message: Message;
  parsedContent: ParsedResponse; // For assistant messages
  isCollapsed: boolean; // For prompt sections
  onToggleCollapse: () => void;
  clickedActions: Set<string>;
  failedActions?: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: any,
    message: Message,
    index: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void; // Using any for action temporarily to match ToolAction
  requestNumber?: number | null; // For user messages
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  isLastMessage?: boolean; // New prop
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  previousAssistantMessage?: Message;
  isGenerating?: boolean;
  isSimpleMode?: boolean;
  onSendMessage?: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
  ) => void;
  onSelectOption?: (messageId: string, option: string) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
}

const MessageBoxCodeBlock: React.FC<{
  code: string;
  language?: string;
  diffStats?: { added: number; removed: number };
  isDiffBlock: boolean;
  prefix?: string;
  statusColor?: string;
}> = ({ code, language, diffStats, isDiffBlock, prefix, statusColor }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(isDiffBlock);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        marginBottom: "8px",
      }}
    >
      <ToolHeader
        title={prefix || language || "code"}
        statusColor={statusColor}
        diffStats={diffStats}
        isCollapsed={isCollapsed}
        onToggleCollapse={
          isDiffBlock ? () => setIsCollapsed(!isCollapsed) : undefined
        }
        headerActions={
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(code);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--vscode-foreground)",
              cursor: "pointer",
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              padding: "2px",
            }}
            title="Copy Code"
          >
            <div
              className="codicon codicon-copy"
              style={{ fontSize: "14px" }}
            />
          </button>
        }
      />
      {!isCollapsed && (
        <div style={{ paddingLeft: "29px" }}>
          <pre
            style={{
              margin: 0,
              padding: "8px",
              overflow: "auto",
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              fontSize: "12px",
              background: "var(--vscode-editor-background)",
              borderRadius: "4px",
            }}
          >
            <code style={{ background: "none", padding: 0 }}>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

const MessageBox: React.FC<MessageBoxProps> = ({
  message,
  parsedContent,
  isCollapsed,
  onToggleCollapse,
  clickedActions,
  failedActions,
  rejectedActions,
  onToolClick,
  requestNumber,
  executionState,
  isLastMessage,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  activeTerminalIds,
  attachedTerminalIds,
  conversationId,
  previousAssistantMessage,
  isGenerating,
  onSendMessage,
  onSelectOption,
  isSimpleMode = true,
  onRevertConversation,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
}) => {
  const { t } = useI18n();

  /**
   * Map known hardcoded error strings to i18n keys.
   * Falls back to the original message if no mapping found.
   */
  const translateError = (raw: string): string => {
    const normalized = raw.trim().toLowerCase();
    const errorMap: Array<[RegExp, I18nKey]> = [
      [/provider returned empty response/i, "errors.providerEmptyResponse"],
      [/no response body/i, "errors.noResponseBody"],
      [/no workspace/i, "errors.noWorkspace"],
      [/path.*argument.*string|path.*required/i, "errors.pathRequired"],
      [/file.*path.*required|missing file path/i, "errors.filePathRequired"],
      [/folder.*path.*required/i, "errors.folderPathRequired"],
      [/security validation failed/i, "errors.securityValidationFailed"],
      [/out of scope.*ignored/i, "errors.pathOutOfScope"],
      [/invalid diff format/i, "errors.invalidDiffFormat"],
      [/search text not found/i, "errors.searchTextNotFound"],
      [/no change made/i, "errors.noChangesMade"],
      [/command validation failed/i, "errors.commandValidationFailed"],
      [
        /unknown upload error|upload.*failed|upload api returned/i,
        "errors.uploadFailed",
      ],
      [/no active account|no.*account.*selected/i, "errors.noAccountSelected"],
      [/file not found/i, "errors.fileNotFound"],
      [/invalid conversation log format/i, "errors.invalidConversationFormat"],
    ];
    for (const [pattern, key] of errorMap) {
      if (pattern.test(raw)) return t(key);
    }
    return raw;
  };

  const [isMessageCollapsed, setIsMessageCollapsed] = React.useState(false);
  const [isThinkingCollapsed, setIsThinkingCollapsed] = React.useState(false);

  /**
   * Build a map of basename → fullPath from prior tool calls in allMessages.
   * Scans <file_path> tags from read_file, write_to_file, replace_in_file, search_files, list_files.
   * This lets us resolve plain filenames like "z_ai_auth.json" to their full paths.
   */
  const knownFilePaths = React.useMemo((): Map<string, string> => {
    const map = new Map<string, string>();
    if (!allMessages) return map;

    const filePathRegex = /<file_path>([^<]+)<\/file_path>/gi;
    const pathRegex = /<path>([^<]+)<\/path>/gi;

    for (const msg of allMessages) {
      if (!msg.content) continue;

      // Extract all <file_path> occurrences
      let m: RegExpExecArray | null;
      filePathRegex.lastIndex = 0;
      while ((m = filePathRegex.exec(msg.content)) !== null) {
        const fullPath = m[1].trim();
        if (!fullPath) continue;
        const basename = fullPath.split(/[/\\]/).pop() || "";
        if (basename && !map.has(basename)) {
          map.set(basename, fullPath);
        }
      }

      // Also try <path> tags (used by some search/list calls)
      pathRegex.lastIndex = 0;
      while ((m = pathRegex.exec(msg.content)) !== null) {
        const fullPath = m[1].trim();
        if (!fullPath) continue;
        const basename = fullPath.split(/[/\\]/).pop() || "";
        if (basename && !map.has(basename)) {
          map.set(basename, fullPath);
        }
      }
    }

    return map;
  }, [allMessages]);

  const handleRetry = React.useCallback(() => {
    if (!onSendMessage) return;

    // Trích xuất các file đã thao tác trong lịch sử tin nhắn
    const operatedFiles = new Set<string>();
    if (allMessages) {
      const filePathRegex = /<file_path>([^<]+)<\/file_path>/gi;
      const pathRegex = /<path>([^<]+)<\/path>/gi;
      allMessages.forEach((msg) => {
        if (msg.content) {
          let match;
          filePathRegex.lastIndex = 0;
          while ((match = filePathRegex.exec(msg.content)) !== null) {
            operatedFiles.add(match[1].trim());
          }
          pathRegex.lastIndex = 0;
          while ((match = pathRegex.exec(msg.content)) !== null) {
            operatedFiles.add(match[1].trim());
          }
        }
      });
    }

    const filesList = Array.from(operatedFiles);
    const errorText = message.content.replace(/^Error:\s*/i, "");

    // Tạo prompt tiếng Anh thông qua hàm buildRetryPrompt từ file retry.ts riêng biệt
    const promptText = buildRetryPrompt(errorText, filesList);

    // Gửi message retry ẩn dưới nền (uiHidden = true) tương tự các auto-req khác
    onSendMessage(
      promptText,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
  }, [message.content, allMessages, onSendMessage]);

  const [showRevertModal, setShowRevertModal] = React.useState(false);

  // If User Message
  if (message.role === "user") {
    // 🆕 FLEXIBLE FILTER: Regex to find the user message block even if not at the start
    const userMsgRegex =
      /## User Message\n<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/;
    const match = message.content.match(userMsgRegex);

    if (!match && !message.content.includes("## User Message")) {
      return null;
    }

    let displayContent = match
      ? match[1]
      : message.content.replace(/^[\s\S]*?## User Message\n/, "");

    // Fallback cleanup if it didn't match the full block regex but has the header
    if (!match) {
      // Legacy: strip old ``` wrapper if present
      if (
        displayContent.startsWith("```") &&
        displayContent.includes("```", 3)
      ) {
        displayContent = displayContent.split("```")[1].trim();
      }
      // Strip new zen-user-content wrapper if partially matched
      displayContent = displayContent
        .replace(/^<zen-user-content>\n?/, "")
        .replace(/\n?<\/zen-user-content>[\s\S]*$/, "");
    }

    // 🆕 Collapsible long messages
    const lineCount = displayContent.split("\n").length;
    const charCount = displayContent.length;
    const isLongMessage = lineCount > 10 || charCount > 500;

    // Auto-collapse on mount if message is long
    React.useEffect(() => {
      if (isLongMessage && !isMessageCollapsed) {
        setIsMessageCollapsed(true);
      }
    }, [isLongMessage]);

    const truncatedContent =
      isLongMessage && isMessageCollapsed
        ? "..." + displayContent.split("\n").slice(-5).join("\n")
        : displayContent;

    return (
      <div
        className="user-message-container"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-md)",
          marginBottom: "var(--spacing-md)",
          opacity: message.isCancelled ? 0.4 : 1,
          filter: message.isCancelled ? "grayscale(1) blur(0.5px)" : "none",
          pointerEvents: message.isCancelled ? "none" : "auto",
          transition: "all 0.3s ease",
          position: "relative",
          zIndex: 1, // Add z-index to avoid overlap issues
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            backgroundColor: "var(--input-bg)",
            padding: "var(--spacing-md)",
            marginLeft: "0px", // Align with left edge since there is no dot
            position: "relative",
          }}
        >
          <style>{``}</style>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {truncatedContent}
          </div>
          {isLongMessage && (
            <div
              onClick={() => setIsMessageCollapsed(!isMessageCollapsed)}
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--vscode-textLink-foreground)",
                cursor: "pointer",
                marginTop: "var(--spacing-xs)",
                fontWeight: 600,
                userSelect: "none",
                textDecoration: "underline",
              }}
            >
              {isMessageCollapsed ? "Show more" : "Show less"}
            </div>
          )}
        </div>
        {onRevertConversation && (
          <button
            className="user-message-undo-btn"
            onClick={() => setShowRevertModal(true)}
            title="Revert conversation to this state"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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
        {showRevertModal &&
          createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setShowRevertModal(false)}
            >
              <div
                style={{
                  backgroundColor: "var(--vscode-editor-background)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "20px 24px",
                  minWidth: "300px",
                  maxWidth: "400px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    marginBottom: "8px",
                  }}
                >
                  Revert conversation?
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--secondary-text)",
                    marginBottom: "16px",
                  }}
                >
                  This will restore all modified files to their state before
                  this message. Messages after this point will be removed.
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setShowRevertModal(false)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      cursor: "pointer",
                      background: "transparent",
                      border: "1px solid var(--border-color)",
                      color: "var(--primary-text)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowRevertModal(false);
                      onRevertConversation!(message.id, message.timestamp);
                    }}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      cursor: "pointer",
                      background: "var(--vscode-button-background)",
                      border: "none",
                      color: "var(--vscode-button-foreground)",
                      fontWeight: 600,
                    }}
                  >
                    Revert
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  // If Assistant Message
  return (
    <div
      className={`assistant-message-container ${message.isError ? "is-error" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0px",
        marginBottom: "var(--spacing-md)",
        paddingLeft: "0px",
        position: "relative",
        opacity: message.isCancelled ? 0.4 : 1,
        filter: message.isCancelled ? "grayscale(1) blur(0.5px)" : "none",
        pointerEvents: message.isCancelled ? "none" : "auto",
        transition: "all 0.3s ease",
        backgroundColor: "transparent",
        borderRadius: "var(--border-radius)",
        border: "none",
        padding: "0px",
      }}
    >
      {/* 3. Interleaved Content (Text + Tools) */}
      {(() => {
        // Prepare render groups
        const groups: Array<
          | {
              type: "metadata";
              content: string;
              faviconUrl?: string;
              key: string;
            }
          | { type: "code"; content: string; language: string; key: string }
          | { type: "html"; content: string; key: string }
          | { type: "file"; content: string; key: string }
          | { type: "markdown"; content: string; key: string }
          | {
              type: "mixed_content";
              segments: any[];
              key: string;
            }
          | {
              type: "tools";
              items: { action: any; index: number }[];
              key: string;
            }
          | {
              type: "question";
              options: string[];
              title?: string;
              optional?: boolean;
              key: string;
            }
          | {
              type: "error";
              content: string;
              key: string;
            }
          | {
              type: "thinking";
              content: string;
              key: string;
            }
        > = [];

        // --- 🆕 METADATA DOT CHECK ---
        const metaChanged =
          !previousAssistantMessage ||
          message.conversationId !== previousAssistantMessage.conversationId ||
          message.providerId !== previousAssistantMessage.providerId ||
          message.modelId !== previousAssistantMessage.modelId ||
          message.accountId !== previousAssistantMessage.accountId ||
          message.email !== previousAssistantMessage.email;

        // If metadata changed, inject the Metadata group
        if (
          metaChanged &&
          (message.providerId || message.modelId || message.email)
        ) {
          const providerStr = message.providerId
            ? `${message.providerId}/`
            : "";
          const modelStr = message.modelId || "unknown-model";
          const emailStr = message.email ? ` by ${message.email}` : "";

          let faviconUrl: string | undefined = undefined;
          if (message.websiteUrl) {
            try {
              const url = new URL(message.websiteUrl);
              faviconUrl = `${url.origin}/favicon.ico`;
            } catch (e) {
              // Ignore invalid url
            }
          }

          groups.push({
            type: "metadata",
            content: `Used ${providerStr}${modelStr}${emailStr}`,
            faviconUrl,
            key: "metadata-info",
          });
        }

        // ------------------------------
        if (message.thinking && message.thinking.trim()) {
          groups.push({
            type: "thinking",
            content: message.thinking,
            key: "thinking-block",
          });
        }

        let currentToolGroup: { action: any; index: number }[] = [];

        // Use contentBlocks from parser
        const blocks = parsedContent.contentBlocks || [];

        // Helper to flush tool group
        const flushTools = () => {
          if (currentToolGroup.length > 0) {
            const firstIndex = currentToolGroup[0].index;
            groups.push({
              type: "tools",
              items: [...currentToolGroup],
              key: `tools-${firstIndex}`,
            });
            currentToolGroup = [];
          }
        };

        if (message.isError) {
          groups.push({
            type: "error",
            content: message.content,
            key: "error-block",
          });
        } else if (blocks.length > 0) {
          blocks.forEach((block, idx) => {
            if (block.type === "tool") {
              const actionIndex = parsedContent.actions.indexOf(block.action);
              currentToolGroup.push({
                action: block.action,
                index: actionIndex !== -1 ? actionIndex : idx,
              });
            } else if (block.type === "file") {
              flushTools();
              groups.push({
                type: "file",
                content: block.content,
                key: `file-${idx}`,
              });
            } else if (block.type === "markdown") {
              flushTools();
              groups.push({
                type: "markdown",
                content: block.content,
                key: `markdown-${idx}`,
              });
            } else if (block.type === "question") {
              flushTools();
              groups.push({
                type: "question",
                options: block.options,
                title: block.title,
                optional: block.optional,
                key: `question-${idx}`,
              });
            } else if (block.type === "mixed_content") {
              flushTools();
              groups.push({
                type: "mixed_content",
                segments: block.segments,
                key: `mixed_content-${idx}`,
              });
            } else {
              // Flush tools before adding non-tool block
              flushTools();

              if (block.type === "code") {
                groups.push({
                  type: "code",
                  content: block.content,
                  language: block.language || "text",
                  key: `code-${groups.length}`,
                });
              } else if (block.type === "html") {
                groups.push({
                  type: "html",
                  content: block.content,
                  key: `html-${groups.length}`,
                });
              }
            }
          });
          // Flush any remaining tools
          flushTools();
        } else {
          // Legacy Fallback
          // 1. Text (Legacy Fallback)
          if (parsedContent.displayText) {
            groups.push({
              type: "markdown",
              content: parsedContent.displayText,
              key: "markdown-legacy",
            });
          }
          // 2. Tools
          if (parsedContent.actions && parsedContent.actions.length > 0) {
            currentToolGroup = parsedContent.actions.map((action, index) => ({
              action,
              index,
            }));
            flushTools();
          }
        }

        let isInteractionBlocked = false;

        // In simple mode, filter out tool groups where all items are invisible
        const SIMPLE_MODE_VISIBLE = new Set([
          "write_to_file",
          "replace_in_file",
          "run_command",
          "execute_agent_action",
        ]);
        const renderGroups = isSimpleMode
          ? groups.filter(
              (g) =>
                g.type !== "tools" ||
                (g as any).items.some((item: any) =>
                  SIMPLE_MODE_VISIBLE.has(item.action.type),
                ),
            )
          : groups;

        return renderGroups.map((group, index) => {
          const isLast = index === renderGroups.length - 1 && isLastMessage;
          const timelineClass = `timeline-item ${isLast ? "last" : ""}`;

          let content = null;

          if (group.type === "metadata") {
            content = (
              <div style={{ paddingBottom: "8px" }}>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: "transparent",
                    top: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                  }}
                >
                  {group.faviconUrl ? (
                    <img
                      src={group.faviconUrl}
                      alt="favicon"
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "2px",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const parent = (e.target as HTMLImageElement)
                          .parentElement;
                        if (parent) {
                          const icon = document.createElement("span");
                          icon.className = "codicon codicon-server-process";
                          icon.style.color =
                            "var(--vscode-descriptionForeground)";
                          icon.style.fontSize = "14px";
                          parent.appendChild(icon);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="codicon codicon-server-process"
                      style={{
                        color: "var(--vscode-descriptionForeground)",
                        fontSize: "14px",
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    paddingLeft: "29px",
                    paddingTop: "4px",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--vscode-descriptionForeground)",
                    lineHeight: 1.6,
                    fontStyle: "italic",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {group.content}
                </div>
              </div>
            );
          } else if (group.type === "thinking") {
            content = (
              <div style={{ paddingBottom: "8px" }}>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: "transparent",
                    top: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                  }}
                >
                  {/* Animated circle-dot — purple */}
                  <span
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "12px",
                      height: "12px",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background:
                          "var(--vscode-editorBracketHighlight-foreground2, #a855f7)",
                        opacity: 0.25,
                      }}
                    />
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background:
                          "var(--vscode-editorBracketHighlight-foreground2, #a855f7)",
                        flexShrink: 0,
                      }}
                    />
                  </span>
                </div>
                <div style={{ paddingLeft: "29px", paddingTop: "4px" }}>
                  {/* THINKING label */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color:
                          "var(--vscode-editorBracketHighlight-foreground2, #a855f7)",
                        opacity: 0.85,
                      }}
                    >
                      Thinking
                    </span>
                  </div>
                  {/* Plain content block */}
                  <div
                    style={{
                      padding: "6px 10px",
                      background:
                        "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                      borderRadius: "4px",
                      border:
                        "1px solid color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 20%, var(--vscode-widget-border, rgba(255,255,255,0.08)))",
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                      fontSize: "11px",
                      lineHeight: "1.5",
                      color:
                        "var(--vscode-descriptionForeground, var(--vscode-editor-foreground))",
                      opacity: 0.85,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: "240px",
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                      scrollbarColor:
                        "var(--vscode-scrollbarSlider-background) transparent",
                    }}
                  >
                    {group.content}
                  </div>
                </div>
              </div>
            );
          } else if (group.type === "code") {
            const isDiffBlock = isDiff(group.content, group.language);
            let displayCode = group.content;
            let diffStats: { added: number; removed: number } | undefined =
              undefined;
            let prefix: string | undefined = undefined;
            let statusColor: string | undefined =
              "var(--vscode-descriptionForeground, #6a737d)";

            if (isDiffBlock) {
              const diffResult = parseDiff(group.content);
              displayCode = diffResult.code;
              diffStats = diffResult.stats;
              prefix = "Edit";
              statusColor =
                "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
            }

            content = (
              <MessageBoxCodeBlock
                code={displayCode}
                language={isDiffBlock ? "python" : group.language}
                diffStats={diffStats}
                isDiffBlock={isDiffBlock}
                prefix={prefix}
                statusColor={statusColor}
              />
            );
          } else if (group.type === "html") {
            content = <HtmlPreview content={group.content} />;
          } else if (group.type === "file") {
            content = (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  backgroundColor: "var(--vscode-badge-background)",
                  color: "var(--vscode-badge-foreground)",
                  fontSize: "12px",
                  cursor: "pointer",
                  marginLeft: "29px",
                }}
                onClick={() => {
                  const vscodeApi = (window as any).vscodeApi;
                  if (vscodeApi) {
                    vscodeApi.postMessage({
                      command: "openFile",
                      path: group.content,
                    });
                  }
                }}
              >
                <FileIcon
                  path={group.content}
                  style={{ width: "14px", height: "14px" }}
                />
                <span>{group.content}</span>
              </div>
            );
          } else if (group.type === "markdown") {
            const dotColor = message.isError
              ? "var(--vscode-errorForeground, #ff4d4f)"
              : "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
            content = (
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: dotColor,
                    boxShadow: `0 0 0 2px var(--vscode-editor-background), 0 0 0 3px color-mix(in srgb, ${dotColor} 50%, transparent)`,
                    top: "10px",
                  }}
                />
                <div
                  style={{
                    paddingLeft: "29px",
                    paddingTop: "4px",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                  }}
                >
                  <MarkdownWithPaths
                    content={group.content}
                    knownFilePaths={knownFilePaths}
                  />
                </div>
              </div>
            );
          } else if (group.type === "mixed_content") {
            const dotColor = message.isError
              ? "var(--vscode-errorForeground, #ff4d4f)"
              : "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
            content = (
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: dotColor,
                    boxShadow: `0 0 0 2px var(--vscode-editor-background), 0 0 0 3px color-mix(in srgb, ${dotColor} 50%, transparent)`,
                    top: "10px",
                  }}
                />
                <div style={{ paddingLeft: "29px", paddingTop: "4px" }}>
                  {group.segments.map((seg: any, i: number) => {
                    if (seg.type === "code") {
                      return (
                        <div
                          key={i}
                          style={{ marginBottom: "8px", marginTop: "4px" }}
                        >
                          <pre
                            style={{
                              margin: 0,
                              padding: "8px",
                              overflow: "auto",
                              fontFamily:
                                "var(--vscode-editor-font-family, monospace)",
                              fontSize: "12px",
                              background: "var(--vscode-editor-background)",
                              borderRadius: "4px",
                            }}
                          >
                            <code style={{ background: "none", padding: 0 }}>
                              {seg.content}
                            </code>
                          </pre>
                        </div>
                      );
                    } else if (seg.type === "markdown") {
                      return (
                        <MarkdownWithPaths
                          key={i}
                          content={seg.content}
                          className="markdown-content-inline"
                          knownFilePaths={knownFilePaths}
                        />
                      );
                    } else {
                      return (
                        <MarkdownWithPaths
                          key={i}
                          content={seg.content}
                          className="markdown-content-inline"
                          knownFilePaths={knownFilePaths}
                        />
                      );
                    }
                  })}
                </div>
              </div>
            );
          } else if (group.type === "question") {
            const isAnswered = !!message.selectedOption;
            const isThisActive = isLastMessage && !isInteractionBlocked;
            const dotColor = isAnswered
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : isThisActive
                ? "var(--vscode-button-background)"
                : "var(--vscode-descriptionForeground)";

            content = (
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: dotColor,
                    boxShadow: `0 0 0 2px var(--vscode-editor-background), 0 0 0 3px color-mix(in srgb, ${dotColor} 50%, transparent)`,
                    top: "28px",
                  }}
                />
                <QuestionBlock
                  options={group.options}
                  title={group.title}
                  optional={group.optional}
                  selectedOption={message.selectedOption}
                  onOptionSelect={(option) => {
                    if (onSelectOption) {
                      onSelectOption(message.id, option);
                    }

                    // Check if there are tools in this message.
                    // If so, useToolExecution will handle sending the combined request
                    // once all tools are complete.
                    const hasTools = (parsedContent.actions?.length || 0) > 0;

                    if (onSendMessage && !hasTools) {
                      const questionTitle = group.title || "Question";
                      onSendMessage(
                        `[question: "${questionTitle}"] Answer: ${option}`,
                        undefined,
                        undefined,
                        undefined,
                        true,
                      );
                    }
                  }}
                  disabled={!!nextUserMessage || isGenerating}
                />
              </div>
            );

            // Update blocking state
            if (!isAnswered) isInteractionBlocked = true;
          } else if (group.type === "error") {
            const errorText = group.content.replace(/^Error:\s*/i, "");
            // Parse error code from "[CODE] message" format
            const codeMatch = errorText.match(/^\[([^\]]+)\]\s*(.*)/s);
            const errorCode = codeMatch ? codeMatch[1] : null;
            const rawMessage = codeMatch ? codeMatch[2] : errorText;
            const translatedMessage = translateError(rawMessage);
            const dotColor = "var(--vscode-testing-iconFailedColor, #f14c4c)";
            const errorColor = "var(--vscode-errorForeground, #f44336)";
            content = (
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: dotColor,
                    boxShadow: `0 0 0 2px var(--vscode-editor-background), 0 0 0 3px ${dotColor}`,
                    top: "10px",
                    border: "none",
                  }}
                />
                <div
                  style={{
                    paddingLeft: "29px",
                    paddingTop: "4px",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Red box container */}
                  <div
                    style={{
                      backgroundColor: `color-mix(in srgb, ${errorColor} 6%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${errorColor} 25%, transparent)`,
                      borderRadius: "6px",
                      padding: "10px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        className="codicon codicon-error"
                        style={{
                          fontSize: "14px",
                          color: errorColor,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          color: errorColor,
                          fontWeight: 700,
                          fontSize: "12px",
                          letterSpacing: "0.3px",
                        }}
                      >
                        ERROR{errorCode ? `: ${errorCode}` : ""}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--vscode-editor-foreground)",
                        opacity: 0.9,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}
                    >
                      {translatedMessage}
                    </div>
                    {onSendMessage && (
                      <button
                        onClick={handleRetry}
                        style={{
                          backgroundColor: `color-mix(in srgb, ${errorColor} 12%, transparent)`,
                          color: errorColor,
                          border: `1px solid color-mix(in srgb, ${errorColor} 30%, transparent)`,
                          padding: "5px 14px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          height: "28px",
                          boxSizing: "border-box",
                          transition: "all 0.2s ease",
                          alignSelf: "flex-start",
                          marginTop: "2px",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${errorColor} 22%, transparent)`;
                          e.currentTarget.style.borderColor = `color-mix(in srgb, ${errorColor} 45%, transparent)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${errorColor} 12%, transparent)`;
                          e.currentTarget.style.borderColor = `color-mix(in srgb, ${errorColor} 30%, transparent)`;
                        }}
                      >
                        <span
                          className="codicon codicon-refresh"
                          style={{
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        />
                        <span>{t("chat.retry")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          } else {
            content = (
              <ToolActionsList
                message={message}
                items={group.items}
                clickedActions={clickedActions}
                failedActions={failedActions}
                rejectedActions={rejectedActions}
                onToolClick={onToolClick}
                executionState={executionState}
                isLastMessage={isLastMessage}
                toolOutputs={toolOutputs}
                terminalStatus={terminalStatus}
                nextUserMessage={nextUserMessage}
                allMessages={allMessages}
                activeTerminalIds={activeTerminalIds}
                attachedTerminalIds={attachedTerminalIds}
                conversationId={conversationId}
                allActions={parsedContent.actions}
                isBlockedByPrecedingInteraction={isInteractionBlocked}
                isVisibleTool={
                  isSimpleMode
                    ? (type) =>
                        type === "write_to_file" ||
                        type === "replace_in_file" ||
                        type === "run_command" ||
                        type === "execute_agent_action"
                    : undefined
                }
                singleLineReviewActions={singleLineReviewActions}
                onConfirmSingleLineAction={onConfirmSingleLineAction}
                onRejectSingleLineAction={onRejectSingleLineAction}
              />
            );

            // Check if THIS group has any pending or busy action that should block subsequent ones
            const hasUnclickedOrBusyAction = group.items.some((item) => {
              const actionId = `${message.id}-action-${item.index}`;
              const hasOutput = toolOutputs && toolOutputs[actionId];
              const isClicked = clickedActions.has(actionId);

              // Check if there is a subsequent message in history containing the output
              const hasHistoryOutput =
                !!nextUserMessage ||
                !!allMessages?.some((m) => m.actionIds?.includes(actionId));

              if (!isClicked && !hasOutput && !hasHistoryOutput) {
                // If it is a write/edit tool, on restore it shouldn't block subsequent tools
                const isWriteTool =
                  item.action.type === "write_to_file" ||
                  item.action.type === "replace_in_file";
                if (isWriteTool) {
                  return false;
                }
                return true;
              }

              // Also block if a run_command is still busy
              if (item.action.type === "run_command" && !hasHistoryOutput) {
                const outputData = toolOutputs?.[actionId];
                const terminalId =
                  (outputData as any)?.terminalId ||
                  item.action.params.terminal_id;
                if (terminalId && terminalStatus?.[terminalId] === "busy") {
                  return true;
                }
              }
              return false;
            });
            if (hasUnclickedOrBusyAction) isInteractionBlocked = true;
          }

          if (group.type === "tools") {
            return <React.Fragment key={group.key}>{content}</React.Fragment>;
          }

          return (
            <div key={group.key} className={timelineClass}>
              {content}
            </div>
          );
        });
      })()}

      {/* 6. Follow-up Options (Legacy) - Hide if we have a proper Question block */}
      {parsedContent.followupOptions &&
        !parsedContent.contentBlocks.some(
          (b: { type: string }) => b.type === "question",
        ) && (
          <FollowupOptions
            options={parsedContent.followupOptions}
            messageId={message.id}
            selectedOption={undefined}
            onOptionClick={(opt: string) => {}}
          />
        )}
    </div>
  );
};

export default MessageBox;
