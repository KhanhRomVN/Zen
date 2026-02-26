import React from "react";
import { CodeBlock } from "../../../CodeBlock";
import { Message } from "../types";
import { ParsedResponse } from "../../../../services/ResponseParser";
import PromptSection from "./PromptSection";
import ThinkingSection from "./ThinkingSection";
import FollowupOptions from "./FollowupOptions";
import RequestDivider from "./RequestDivider";
import ToolActionsList from "./ToolActions/index";
import HtmlPreview from "./HtmlPreview";
import FileIcon from "../../../common/FileIcon";
import { isDiff, parseDiff } from "../../../../utils/diffUtils";
import { extensionService } from "../../../../services/ExtensionService";
import { ToolHeader } from "../../../ToolHeader";
import "../../../TerminalBlock.css";

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
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
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
  activeTerminalIds,
  attachedTerminalIds,
  conversationId,
}) => {
  const [isMessageCollapsed, setIsMessageCollapsed] = React.useState(false);

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
      {/* 2. Thinking Section */}
      {parsedContent.thinking && (
        <div className="timeline-item">
          <ThinkingSection
            message={message}
            thinking={parsedContent.thinking}
            isCollapsed={isCollapsed}
            onToggleCollapse={onToggleCollapse}
          />
        </div>
      )}

      {/* 3. Interleaved Content (Text + Tools) */}
      {(() => {
        // Prepare render groups
        const groups: Array<
          | { type: "text"; content: string; key: string }
          | { type: "code"; content: string; language: string; key: string }
          | { type: "html"; content: string; key: string }
          | { type: "file"; content: string; key: string }
          | {
              type: "tools";
              items: { action: any; index: number }[];
              key: string;
            }
        > = [];

        let currentToolGroup: { action: any; index: number }[] = [];

        // Use contentBlocks from parser
        const blocks = parsedContent.contentBlocks || [];

        // Helper to flush tool group
        const flushTools = () => {
          if (currentToolGroup.length > 0) {
            groups.push({
              type: "tools",
              items: [...currentToolGroup],
              key: `tools-${groups.length}`,
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
            } else if (block.type === "file") {
              flushTools();
              groups.push({
                type: "file",
                content: block.content,
                key: `file-${groups.length}`,
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
                // Text block
                groups.push({
                  type: "text",
                  content: block.content,
                  key: `text-${groups.length}`,
                });
              }
            }
          });
          // Flush any remaining tools
          flushTools();
        } else {
          // Legacy Fallback
          // 1. Text
          if (parsedContent.displayText) {
            groups.push({
              type: "text",
              content: parsedContent.displayText,
              key: "text-legacy",
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

          if (group.type === "code") {
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
                    backgroundColor: "var(--vscode-descriptionForeground)",
                    opacity: 0.8,
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
