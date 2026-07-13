import React from "react";
import { Message } from "../../types/message";
import { ParsedResponse } from "../../services/ResponseParser";
import ToolActionsList from "../tools/index";
import FileIcon from "@/icons/FileIcon";
import { isDiff, parseDiff } from "../../../../utils/diffUtils";
import { ToolHeader } from "../tools/ToolHeader";
import ErrorBlock from "../blocks/error/ErrorBlock";
import "../blocks/run_command/TerminalBlock.css";
import "../blocks/markdown/MarkdownBlock.css";
import { MarkdownBlock } from "../blocks/markdown/MarkdownBlock";
import { QuestionBlock } from "../blocks/question/QuestionBlock";

interface AIMessageBoxProps {
  message: Message;
  parsedContent: ParsedResponse;
  clickedActions: Set<string>;
  failedActions?: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: any,
    message: Message,
    index: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  isLastMessage?: boolean;
  hasNextAssistantMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  previousAssistantMessage?: Message;
  isGenerating?: boolean;
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
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  onGitConfirm?: (items: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
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

const AIMessageBox: React.FC<AIMessageBoxProps> = ({
  message,
  parsedContent,
  clickedActions,
  failedActions,
  rejectedActions,
  onToolClick,
  executionState,
  isLastMessage,
  hasNextAssistantMessage = false,
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
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
  onGitConfirm,
  onGitCancel,
  gitStatusItems,
  gitStatusBranch,
  isGitProcessing,
  isGitStatusVisible = true,
  onBackToHome,
}) => {
  /**
   * Map known hardcoded error strings to English messages.
   */
  const translateError = (raw: string): string => {
    // Simple hardcoded English error messages
    const normalized = raw.trim().toLowerCase();
    if (/provider returned empty response/i.test(normalized))
      return "Provider returned empty response";
    if (/no response body/i.test(normalized)) return "No response body";
    if (/no workspace/i.test(normalized))
      return "No workspace folder is open. Open a folder to use file operations.";
    if (/path.*argument.*string|path.*required/i.test(normalized))
      return "Path argument must be a string and is required.";
    if (/file.*path.*required|missing file path/i.test(normalized))
      return "File path is required.";
    if (/folder.*path.*required/i.test(normalized))
      return "Folder path is required.";
    if (/security validation failed/i.test(normalized))
      return "Security validation failed: path is outside workspace.";
    if (/out of scope.*ignored/i.test(normalized))
      return "Path is out of scope and will be ignored.";
    if (/invalid diff format/i.test(normalized))
      return "Invalid diff format.";
    if (/search text not found/i.test(normalized))
      return "Search text not found in file.";
    if (/no change made/i.test(normalized)) return "No changes were made.";
    if (/command validation failed/i.test(normalized))
      return "Command validation failed.";
    if (/unknown upload error|upload.*failed|upload api returned/i.test(normalized))
      return "File upload failed.";
    if (/no active account|no.*account.*selected/i.test(normalized))
      return "No active account. Please select an account first.";
    if (/file not found/i.test(normalized)) return "File not found.";
    if (/invalid conversation log format/i.test(normalized))
      return "Invalid conversation log format.";
    return raw;
  };

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

  return (
    <div
      className={`assistant-message-container ${message.isError ? "is-error" : ""} ${
        hasNextAssistantMessage === false && message.role === "assistant" ? "is-last-assistant" : ""
      }`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0px",
        marginBottom: "4px",
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
              questions?: import("../../types/message").Question[];
              key: string;
            }
          | {
              type: "error";
              content: string;
              key: string;
            }
        > = [];

        // Skip metadata dot for commit messages
        const isCommitMessage =
          message.content?.includes("[COMMIT_MESSAGE_REQUEST]") ||
          message.content?.includes("<commit_message>");

        const metaChanged =
          !previousAssistantMessage ||
          message.conversationId !== previousAssistantMessage.conversationId ||
          message.providerId !== previousAssistantMessage.providerId ||
          message.modelId !== previousAssistantMessage.modelId ||
          message.accountId !== previousAssistantMessage.accountId ||
          message.email !== previousAssistantMessage.email;

        // If metadata changed, inject the Metadata group (skip for commit messages)
        if (
          !isCommitMessage &&
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

        // Only show message.thinking while generating, auto-hide when done

        let currentToolGroup: { action: any; index: number }[] = [];

        // Use contentBlocks from parser
        const blocks = parsedContent.contentBlocks || [];
        
        // Track if we've already added thinking from message.thinking
        const hasAddedThinking = false;

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
            } else if (block.type === "thinking") {
              // Skip - thinking blocks are rendered in ChatBody separately
            } else if (block.type === "question") {
              flushTools();
              groups.push({
                type: "question",
                options: block.options,
                title: block.title,
                optional: block.optional,
                questions: block.questions,
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

        // Render all groups
        const renderGroups = groups;

        return renderGroups.map((group, index) => {
          let content = null;

          if (group.type === "metadata") {
            content = (
              <div style={{ paddingBottom: "8px" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "15px",
                    transform: "translateX(-50%)",
                    backgroundColor: "transparent",
                    top: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    width: "8px",
                    height: "8px",
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
                  style={{
                    paddingLeft: "29px",
                    paddingTop: "4px",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                  }}
                >
                  <MarkdownBlock
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
                        <MarkdownBlock
                          key={i}
                          content={seg.content}
                          className="markdown-content-inline"
                          knownFilePaths={knownFilePaths}
                        />
                      );
                    } else {
                      return (
                        <MarkdownBlock
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
            const isAnswered =
              !!message.selectedOption ||
              (message.questionAnswers &&
                Object.keys(message.questionAnswers).length > 0);
            const isThisActive = isLastMessage && !isInteractionBlocked;
            const dotColor = isAnswered
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : isThisActive
                ? "var(--vscode-button-background)"
                : "var(--vscode-descriptionForeground)";

            // Check if this is the new paginated format (has questions array)
            const hasQuestions = group.questions && group.questions.length > 0;

            // Render QuestionBlock - it now manages its own summary mode internally
            content = (
              <QuestionBlock
                questions={hasQuestions ? group.questions : undefined}
                options={!hasQuestions ? group.options : undefined}
                title={group.title}
                optional={group.optional}
                selectedOption={
                  !hasQuestions ? message.selectedOption : undefined
                }
                initialAnswers={
                  hasQuestions ? message.questionAnswers || {} : undefined
                }
                disabled={!!nextUserMessage || isGenerating}
                onAnswer={(questionId, value) => {
                  if (!hasQuestions) return;
                  if (onSelectOption) {
                    const answerStr = JSON.stringify({ questionId, value });
                    onSelectOption(message.id, answerStr);
                  }
                }}
                onAllAnswered={(answers) => {
                  if (!hasQuestions) return;
                  if (onSelectOption) {
                    // Include questions in payload so handleSelectOption can format and auto-submit
                    const allAnsweredStr = JSON.stringify({
                      allAnswered: true,
                      answers,
                      questions: group.questions || [],
                    });
                    onSelectOption(message.id, allAnsweredStr);
                  }
                  // Auto-submit is now handled inside useChatLLM.handleSelectOption
                }}
                onOptionSelect={(option: string) => {
                  if (hasQuestions) return;
                  if (onSelectOption) {
                    onSelectOption(message.id, option);
                  }
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
              />
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
            content = (
              <ErrorBlock
                content={translatedMessage}
                errorCode={errorCode || undefined}
                isLast={false}
                isLastMessage={isLastMessage}
              />
            );
            return <React.Fragment key={group.key}>{content}</React.Fragment>;
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
                isVisibleTool={undefined}
                singleLineReviewActions={singleLineReviewActions}
                onConfirmSingleLineAction={onConfirmSingleLineAction}
                onRejectSingleLineAction={onRejectSingleLineAction}
                onGitConfirm={onGitConfirm}
                onGitCancel={onGitCancel}
                gitStatusItems={gitStatusItems}
                gitStatusBranch={gitStatusBranch}
                isGitProcessing={isGitProcessing}
                isGitStatusVisible={isGitStatusVisible}
                onBackToHome={onBackToHome}
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

          if (group.type === "tools" || group.type === "question") {
            return <React.Fragment key={group.key}>{content}</React.Fragment>;
          }

          return (
            <div key={group.key}>
              {content}
            </div>
          );
        });
      })()}
    </div>
  );
};

export default AIMessageBox;
