import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { CodeBlock } from "../../../CodeBlock";
import { Message } from "../types";
import {
  ParsedResponse,
  TaskProgressItem,
} from "../../../../services/ResponseParser";
import PromptSection from "./PromptSection";
import FollowupOptions from "./FollowupOptions";
import RequestDivider from "./RequestDivider";
import ToolActionsList from "./ToolActions/index";
import HtmlPreview from "./HtmlPreview";
import FileIcon from "../../../common/FileIcon";
import { isDiff, parseDiff } from "../../../../utils/diffUtils";
import { extensionService } from "../../../../services/ExtensionService";
import { ToolHeader } from "../../../ToolHeader";
import { RichtextBlock } from "../../../RichtextBlock";
import "../../../TerminalBlock.css";
import "./MarkdownContent.css";

interface MessageBoxProps {
  message: Message;
  parsedContent: ParsedResponse; // For assistant messages
  isCollapsed: boolean; // For prompt/thinking sections
  onToggleCollapse: () => void;
  clickedActions: Set<string>;
  failedActions?: Set<string>;
  onToolClick: (action: any, message: Message, index: number) => void; // Using any for action temporarily to match ToolAction
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
  isGenerating?: boolean; // Prop to indicate if this message is currently being generated
}

const MessageBoxCodeBlock: React.FC<{
  code: string;
  language?: string;
  maxLines?: number;
  lineHighlights?: any;
  diffStats?: { added: number; removed: number };
  isDiffBlock: boolean;
  prefix?: string;
  statusColor?: string;
}> = ({
  code,
  language,
  maxLines,
  lineHighlights,
  diffStats,
  isDiffBlock,
  prefix,
  statusColor,
}) => {
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
      <div style={{ paddingLeft: "29px" }}>
        <CodeBlock
          code={code}
          language={language}
          maxLines={maxLines}
          isCollapsed={isCollapsed}
          showLineNumbers={isDiffBlock}
          lineHighlights={lineHighlights}
        />
      </div>
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
}) => {
  const [isMessageCollapsed, setIsMessageCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (terminalStatus && Object.keys(terminalStatus).length > 0) {
      console.log(
        `[MessageBox ${message.id}] Terminal status prop received:`,
        terminalStatus,
      );
    }
  }, [terminalStatus, message.id]);

  // If User Message
  if (message.role === "user") {
    // 🆕 FLEXIBLE FILTER: Regex to find the user message block even if not at the start
    const userMsgRegex = /## User Message\n```\n([\s\S]*?)\n```/;
    const match = message.content.match(userMsgRegex);

    if (!match && !message.content.includes("## User Message")) {
      return null;
    }

    let displayContent = match
      ? match[1]
      : message.content.replace(/^[\s\S]*?## User Message\n/, "");

    // Fallback cleanup if it didn't match the full block regex but has the header
    if (!match) {
      if (
        displayContent.startsWith("```") &&
        displayContent.includes("```", 3)
      ) {
        displayContent = displayContent.split("```")[1].trim();
      }
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
        ? displayContent.split("\n").slice(0, 5).join("\n") + "..."
        : displayContent;

    return (
      <div
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
          }}
        >
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
      </div>
    );
  }

  // If Assistant Message
  return (
    <div
      className="assistant-message-container"
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
      }}
    >
      {/* 2. Thinking Section (Moved inside interleaved content) */}

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
          | { type: "thinking"; content: string; key: string }
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
              type: "task_progress";
              taskName: string | null;
              taskSummary: string | null;
              items: TaskProgressItem[];
              key: string;
            }
          | {
              type: "tools";
              items: { action: any; index: number }[];
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

        // --- 🆕 THINKING BLOCK ---
        if (
          parsedContent.thinking &&
          isGenerating &&
          !parsedContent.isThinkingClosed
        ) {
          groups.push({
            type: "thinking",
            content: parsedContent.thinking,
            key: "thinking-info",
          });
        }
        // ------------------------------

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

        if (blocks.length > 0) {
          blocks.forEach((block, idx) => {
            if (block.type === "tool") {
              const actionIndex = parsedContent.actions.indexOf(block.action);
              currentToolGroup.push({
                action: block.action,
                index: actionIndex !== -1 ? actionIndex : idx, // Fallback index if not found
              });
            } else if (block.type === "task_progress") {
              // Flush tools before adding task_progress block
              flushTools();
              groups.push({
                type: "task_progress",
                taskName: block.taskName,
                taskSummary: block.taskSummary,
                items: block.items,
                key: `task_progress-${idx}`,
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
              } else {
                // Text block (legacy map to markdown)
                groups.push({
                  type: "markdown",
                  content: block.content,
                  key: `markdown-${idx}`,
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

        return groups.map((group, index) => {
          const isLast = index === groups.length - 1;
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
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: "var(--vscode-descriptionForeground)",
                    top: "10px",
                  }}
                />
                <div
                  style={{
                    paddingLeft: "29px",
                    paddingTop: "4px",
                    paddingBottom: "8px",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--secondary-text)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    opacity: 0.8,
                  }}
                >
                  {group.content}
                </div>
              </div>
            );
          } else if (group.type === "code") {
            const isDiffBlock = isDiff(group.content, group.language);
            let displayCode = group.content;
            let lineHighlights: any = undefined;
            let diffStats: { added: number; removed: number } | undefined =
              undefined;

            let prefix: string | undefined = undefined;
            let statusColor: string | undefined = "#6a737d"; // Default dot color

            if (isDiffBlock) {
              const diffResult = parseDiff(group.content);
              displayCode = diffResult.code;
              lineHighlights = diffResult.lineHighlights;
              diffStats = diffResult.stats;
              prefix = "Edit";
              statusColor = "#3fb950";
            }

            content = (
              <MessageBoxCodeBlock
                code={displayCode}
                language={isDiffBlock ? "python" : group.language}
                maxLines={25}
                lineHighlights={lineHighlights}
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
          } else if (group.type === "text") {
            const renderFormattedText = (text: string) => {
              const parts = text.split(/(\*\*[\s\S]*?\*\*)/);
              return parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return <strong key={i}>{part.slice(2, -2)}</strong>;
                }
                return <span key={i}>{part}</span>;
              });
            };

            content = (
              <div
                style={
                  {
                    /* paddingBottom removed to rely on timeline-item padding */
                  }
                }
              >
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: "#3fb950",
                    top: "10px",
                  }}
                />
                <div
                  style={{
                    paddingLeft: "29px", // Consistent with timeline-content
                    paddingTop: "4px", // Nhích lên 4px để thẳng hàng với dot ở 10px
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {renderFormattedText(group.content.trim())}
                </div>
              </div>
            );
          } else if (group.type === "task_progress") {
            const totalTasks = group.items.length;
            const completedTasks = group.items.filter(
              (i) => i.completed,
            ).length;

            content = (
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: "#3fb950",
                    top: "10px",
                  }}
                />
                <div
                  style={{
                    paddingLeft: "29px",
                    paddingTop: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    {totalTasks > 0 && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          backgroundColor: "var(--vscode-badge-background)",
                          color: "var(--vscode-badge-foreground)",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          fontFamily:
                            "var(--vscode-editor-font-family, monospace)",
                        }}
                      >
                        {completedTasks}/{totalTasks}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--vscode-editor-foreground)",
                      }}
                    >
                      {group.taskName || "Task Progress"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          color: item.completed
                            ? "var(--vscode-descriptionForeground)"
                            : "var(--vscode-editor-foreground)",
                          opacity: item.completed ? 0.7 : 0.9,
                          padding: "2px 0",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "16px",
                            height: "16px",
                            flexShrink: 0,
                          }}
                        >
                          {item.completed ? (
                            <span
                              className="codicon codicon-check"
                              style={{ color: "#3fb950", fontSize: "14px" }}
                            />
                          ) : (
                            <span
                              className="codicon codicon-circle-outline"
                              style={{ opacity: 0.4, fontSize: "12px" }}
                            />
                          )}
                        </span>
                        <span
                          style={{
                            textDecoration: item.completed
                              ? "line-through"
                              : "none",
                            lineHeight: 1.4,
                          }}
                        >
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          } else if (group.type === "markdown") {
            const htmlContent = DOMPurify.sanitize(
              marked.parse(group.content) as string,
            );

            content = (
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: "#3fb950",
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
                  className="markdown-content-inline"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>
            );
          } else if (group.type === "mixed_content") {
            content = (
              <div>
                <div
                  className="timeline-dot"
                  style={{
                    backgroundColor: "#3fb950",
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
                          <CodeBlock
                            code={seg.content}
                            language={seg.language}
                            isCollapsed={false}
                            showLineNumbers={false}
                          />
                        </div>
                      );
                    } else if (seg.type === "markdown") {
                      const htmlContent = DOMPurify.sanitize(
                        marked.parse(seg.content) as string,
                      );
                      return (
                        <div
                          key={i}
                          className="markdown-content-inline"
                          dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                      );
                    } else {
                      // Fallback for any other segment type, render as markdown
                      const htmlContent = DOMPurify.sanitize(
                        marked.parse(seg.content) as string,
                      );
                      return (
                        <div
                          key={i}
                          className="markdown-content-inline"
                          dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                      );
                    }
                  })}
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
              />
            );
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

      {/* 6. Follow-up Options */}
      {parsedContent.followupOptions && (
        <FollowupOptions
          options={parsedContent.followupOptions}
          messageId={message.id}
          selectedOption={undefined}
          onOptionClick={(opt) => {}}
        />
      )}
    </div>
  );
};

export default MessageBox;
