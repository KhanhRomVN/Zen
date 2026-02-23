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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-sm)",
        marginBottom: "var(--spacing-md)",
        opacity: message.isCancelled ? 0.4 : 1,
        filter: message.isCancelled ? "grayscale(1) blur(0.5px)" : "none",
        pointerEvents: message.isCancelled ? "none" : "auto",
        transition: "all 0.3s ease",
      }}
    >
      {/* 2. Thinking Section */}
      {parsedContent.thinking && (
        <ThinkingSection
          message={message}
          thinking={parsedContent.thinking}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
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

        return groups.map((group) => {
          if (group.type === "code") {
            const isDiffBlock = isDiff(group.content, group.language);
            let displayCode = group.content;
            let lineHighlights: any = undefined;
            let headerActions: any = undefined;
            let diffStats: { added: number; removed: number } | undefined =
              undefined;

            let defaultCollapsed = false;
            let prefix: string | undefined = undefined;
            let statusColor: string | undefined = undefined;

            if (isDiffBlock) {
              const diffResult = parseDiff(group.content);
              displayCode = diffResult.code;
              lineHighlights = diffResult.lineHighlights;
              // Pass diff stats to CodeBlock
              diffStats = diffResult.stats;
              // Phase 3: Default collapsed for edits
              defaultCollapsed = true;
              prefix = "Edit";
              statusColor = "#3fb950";
            }

            return (
              <div key={group.key}>
                <CodeBlock
                  code={displayCode}
                  language={isDiffBlock ? "python" : group.language}
                  maxLines={25}
                  showCopyButton={true}
                  lineHighlights={lineHighlights}
                  diffStats={diffStats}
                  headerActions={headerActions}
                  defaultCollapsed={defaultCollapsed}
                  prefix={prefix}
                  statusColor={statusColor}
                  showLineNumbers={isDiffBlock} // Only show line numbers for diff blocks (file changes), not standard text blocks
                  isCollapsible={isDiffBlock} // Only allow collapsing for diff blocks (file changes), standard code blocks are always expanded
                />
              </div>
            );
          } else if (group.type === "html") {
            return (
              <div key={group.key}>
                <HtmlPreview content={group.content} />
              </div>
            );
          } else if (group.type === "file") {
            return (
              <div
                key={group.key}
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
            // Helper to render **bold** text
            const renderFormattedText = (text: string) => {
              const parts = text.split(/(\*\*[\s\S]*?\*\*)/);
              return parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return <strong key={i}>{part.slice(2, -2)}</strong>;
                }
                return <span key={i}>{part}</span>;
              });
            };

            return (
              <div
                key={group.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0px",
                  borderRadius: "var(--border-radius)",
                  backgroundColor: "transparent", // Clean look
                  padding: "0",
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
                  {renderFormattedText(group.content.trim())}
                </div>
              </div>
            );
          } else {
            return (
              <ToolActionsList
                key={group.key}
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
