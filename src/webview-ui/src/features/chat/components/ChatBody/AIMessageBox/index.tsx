import React from "react";

// ICONS
import FileIcon from "@/icons/FileIcon";

// CONSTANTS
import {
  EXECUTION_STATUS,
  TOOL_ACTION_TYPES,
} from "@/features/chat/constants/constants";

// TYPES
import { Message, Question } from "@/features/chat/types/message";
import { ParsedResponse } from "@/features/chat/services/ResponseParser";

// UTILS
import { isDiff, parseDiff } from "@/utils/diffUtils";

// COMPONENTS
import CodeBlock from "./blocks/code/CodeBlock";
import MarkdownBlock from "./blocks/markdown/MarkdownBlock";
import QuestionBlock from "./blocks/question/QuestionBlock";
import ErrorBlock from "./blocks/error/ErrorBlock";
import WarningBlock from "./blocks/warning/WarningBlock";
import ToolAction from "./ToolAction";
import ResponseMetadataBar from "./ResponseMetadataBar";

// STYLES
import "./blocks/run_command/TerminalBlock.css";
import "./blocks/markdown/MarkdownBlock.css";

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
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  isLastMessage?: boolean;
  hasNextAssistantMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
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
  responseNumber?: number | null;
}

const AIMessageBoxInternal: React.FC<AIMessageBoxProps> = ({
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
  responseNumber,
}) => {
  // Track render count for this specific message
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  const translateError = (raw: string): string => {
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
    if (/invalid diff format/i.test(normalized)) return "Invalid diff format.";
    if (/search text not found/i.test(normalized))
      return "Search text not found in file.";
    if (/no change made/i.test(normalized)) return "No changes were made.";
    if (/command validation failed/i.test(normalized))
      return "Command validation failed.";
    if (
      /unknown upload error|upload.*failed|upload api returned/i.test(
        normalized,
      )
    )
      return "File upload failed.";
    if (/no active account|no.*account.*selected/i.test(normalized))
      return "No active account. Please select an account first.";
    if (/file not found/i.test(normalized)) return "File not found.";
    if (/invalid conversation log format/i.test(normalized))
      return "Invalid conversation log format.";
    return raw;
  };

  //   Cache previousUserMessage lookup. Only recompute when the message
  // list length changes or the current message id changes (not on every render
  // where allMessages is a new array reference with same content).
  const prevUserMsgCacheRef = React.useRef<{
    allMessagesLength: number;
    messageId: string;
    result: Message | null;
  } | null>(null);

  const previousUserMessage = React.useMemo((): Message | null => {
    const startTime = performance.now();

    if (!allMessages || !message) return null;

    // Use cached result if messages array hasn't changed structurally
    const cache = prevUserMsgCacheRef.current;
    if (
      cache &&
      cache.allMessagesLength === allMessages.length &&
      cache.messageId === message.id
    ) {
      return cache.result;
    }

    const msgIndex = allMessages.findIndex((m) => m.id === message.id);
    let result: Message | null = null;
    if (msgIndex > 0) {
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (allMessages[i].role === "user") {
          result = allMessages[i];
          break;
        }
      }
    }

    // Update cache
    prevUserMsgCacheRef.current = {
      allMessagesLength: allMessages.length,
      messageId: message.id,
      result,
    };

    return result;
  }, [allMessages, message, responseNumber]);

  //   Cache knownFilePaths computation. This scans all messages for file paths
  // using regex — expensive O(n*m) operation. Only recompute when the number of
  // messages changes (new message added), not on every render during streaming.
  const knownFilePathsCacheRef = React.useRef<{
    allMessagesLength: number;
    lastMessageId: string;
    map: Map<string, string>;
  } | null>(null);

  const knownFilePaths = React.useMemo((): Map<string, string> => {
    const _startTime = performance.now();

    if (!allMessages) return new Map();

    // Use cached result if messages array hasn't changed structurally
    const lastMsg = allMessages[allMessages.length - 1];
    const cache = knownFilePathsCacheRef.current;
    if (
      cache &&
      cache.allMessagesLength === allMessages.length &&
      cache.lastMessageId === lastMsg?.id
    ) {
      return cache.map;
    }

    const map = new Map<string, string>();
    const filePathRegex = /(?:^|\s)([\/~][\w\-\.\/]+\.\w+)(?:\s|$)/g;
    let totalMatches = 0;

    allMessages.forEach((msg, msgIndex) => {
      if (!msg.content) return;
      const msgStartTime = performance.now();
      const matches = msg.content.matchAll(filePathRegex);
      let matchCount = 0;
      for (const match of matches) {
        matchCount++;
        totalMatches++;
        const fullPath = match[1];
        const basename = fullPath.split("/").pop();
        if (basename) {
          map.set(basename, fullPath);
        }
      }
    });

    // Update cache
    knownFilePathsCacheRef.current = {
      allMessagesLength: allMessages.length,
      lastMessageId: lastMsg?.id,
      map,
    };

    return map;
  }, [allMessages, responseNumber]);

  return (
    <div
      className={`assistant-message-container ${message.isError ? "is-error" : ""} ${
        hasNextAssistantMessage === false && message.role === "assistant"
          ? "is-last-assistant"
          : ""
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
      {(() => {
        const groups: Array<
          | { type: "code"; content: string; language: string; key: string }
          | { type: "file"; content: string; key: string }
          | { type: "markdown"; content: string; key: string }
          | { type: "mixed_content"; segments: any[]; key: string }
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
              questions?: Question[];
              key: string;
            }
          | {
              type: "error";
              content: string;
              errorCode?: string;
              toolName?: string;
              toolParams?: Record<string, any>;
              key: string;
            }
          | { type: "response_number"; content: string; key: string }
          | { type: "warning"; label: string; message: string; key: string }
        > = [];

        if (
          responseNumber !== null &&
          responseNumber !== undefined &&
          !message.isError
        ) {
          groups.push({
            type: "response_number",
            content: `[${responseNumber}]`,
            key: "response-number",
          });
        }

        const isCommitMessage =
          message.content?.includes("[COMMIT_MESSAGE_REQUEST]") ||
          message.content?.includes("<commit_message>");

        let currentToolGroup: { action: any; index: number }[] = [];
        const blocks = parsedContent.contentBlocks || [];

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
        } else if (parsedContent.onlyThinkingDetected) {
          // 🛡️ FALLBACK: Response chỉ có thinking, hiển thị warning
          groups.push({
            type: "warning" as any,
            label: "WARNING",
            message:
              "Response contains only internal reasoning (thinking blocks) with no visible content or actions. The AI may need to continue or regenerate the response.",
            key: "only-thinking-warning",
          });
        } else if (blocks.length > 0) {
          blocks.forEach((block, idx) => {
            if (block.type === "tool") {
              const actionIndex = parsedContent.actions.indexOf(block.action);
              currentToolGroup.push({
                action: block.action,
                index: actionIndex !== -1 ? actionIndex : idx,
              });
            } else if (block.type === "error") {
              flushTools();
              groups.push({
                type: "error",
                content: block.content,
                errorCode: block.errorCode,
                toolName: block.toolName,
                toolParams: block.toolParams,
                key: `error-${idx}`,
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
              // Skip
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
          flushTools();
        } else {
          if (parsedContent.displayText) {
            groups.push({
              type: "markdown",
              content: parsedContent.displayText,
              key: "markdown-legacy",
            });
          }
          if (parsedContent.actions && parsedContent.actions.length > 0) {
            currentToolGroup = parsedContent.actions.map((action, index) => ({
              action,
              index,
            }));
            flushTools();
          }
        }

        let isInteractionBlocked = false;
        const renderGroups = groups;

        return renderGroups.map((group, index) => {
          let content = null;
          const isLastGroup = index === renderGroups.length - 1;

          if (group.type === "response_number") {
            content = (
              <ResponseMetadataBar
                responseNumber={responseNumber!}
                message={message}
                previousUserMessage={previousUserMessage}
              />
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
              <CodeBlock
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
            content = (
              <div
                style={{
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
            );
          } else if (group.type === "mixed_content") {
            content = (
              <div style={{ paddingTop: "4px" }}>
                {group.segments.map((seg: any, i: number) => {
                  if (seg.type === "code") {
                    return (
                      <CodeBlock
                        key={i}
                        code={seg.content}
                        language={seg.language}
                        enableWordWrap={true}
                      />
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
            );
          } else if (group.type === "question") {
            const isAnswered = !!message.selectedOption;
            const isThisActive = isLastMessage && !isInteractionBlocked;
            const hasQuestions = group.questions && group.questions.length > 0;
            content = (
              <QuestionBlock
                questions={hasQuestions ? group.questions : undefined}
                options={!hasQuestions ? group.options : undefined}
                title={group.title}
                optional={group.optional}
                selectedOption={
                  !hasQuestions ? message.selectedOption : undefined
                }
                questionAnswers={
                  hasQuestions ? message.questionAnswers : undefined
                }
                disabled={!!nextUserMessage || isGenerating}
                onAnswer={(questionId, value) => {
                  if (!hasQuestions) return;
                  if (onSelectOption) {
                    onSelectOption(
                      message.id,
                      JSON.stringify({ questionId, value }),
                    );
                  }
                }}
                onAllAnswered={(answers) => {
                  if (!hasQuestions) return;
                  if (onSelectOption) {
                    onSelectOption(
                      message.id,
                      JSON.stringify({
                        allAnswered: true,
                        answers,
                        questions: group.questions || [],
                      }),
                    );
                  }
                }}
                onOptionSelect={(option: string) => {
                  if (hasQuestions) return;
                  if (onSelectOption) {
                    onSelectOption(message.id, option);
                  }
                  const hasTools = (parsedContent.actions?.length || 0) > 0;
                  if (onSendMessage && !hasTools) {
                    onSendMessage(
                      `[question: "${group.title || "Question"}"] Answer: ${option}`,
                      undefined,
                      undefined,
                      undefined,
                      true,
                    );
                  }
                }}
              />
            );
            if (!isAnswered) isInteractionBlocked = true;
          } else if (group.type === "error") {
            const errorText = group.content.replace(/^Error:\s*/i, "");
            const translatedMessage = translateError(errorText);

            // If we have toolName, use it as the label (e.g., "READ FILE")
            // Otherwise use default "ERROR"
            const errorLabel = group.toolName
              ? group.toolName.toUpperCase().replace(/_/g, " ")
              : "ERROR";

            content = (
              <ErrorBlock
                content={translatedMessage}
                errorCode={group.errorCode}
                isLast={isLastGroup}
                isLastMessage={isLastMessage}
                maxHeight="300px"
                label={errorLabel}
              />
            );

            return <React.Fragment key={group.key}>{content}</React.Fragment>;
          } else if (group.type === "warning") {
            // 🛡️ Render WarningBlock for only-thinking responses
            content = (
              <WarningBlock
                label={group.label}
                message={group.message}
                warningColor="var(--vscode-editorWarning-foreground, #cca700)"
                isPulsing={false}
              />
            );
            return <React.Fragment key={group.key}>{content}</React.Fragment>;
          } else {
            content = (
              <ToolAction
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
            const hasUnclickedOrBusyAction = group.items.some((item) => {
              const actionId = `${message.id}-action-${item.index}`;
              const hasOutput = toolOutputs && toolOutputs[actionId];
              const isClicked = clickedActions.has(actionId);
              const hasHistoryOutput =
                !!nextUserMessage ||
                !!allMessages?.some((m) => m.actionIds?.includes(actionId));
              if (!isClicked && !hasOutput && !hasHistoryOutput) {
                const isWriteTool =
                  item.action.type === "write_to_file" ||
                  item.action.type === "replace_in_file";
                if (isWriteTool) return false;
                return true;
              }
              if (item.action.type === "run_command" && !hasHistoryOutput) {
                const outputData = toolOutputs?.[actionId];
                const terminalId =
                  (outputData as any)?.terminalId ||
                  item.action.params.terminal_id;
                if (terminalId && terminalStatus?.[terminalId] === "busy")
                  return true;
              }
              return false;
            });
            if (hasUnclickedOrBusyAction) isInteractionBlocked = true;
          }

          if (group.type === "tools" || group.type === "question") {
            return <React.Fragment key={group.key}>{content}</React.Fragment>;
          }
          return <React.Fragment key={group.key}>{content}</React.Fragment>;
        });
      })()}
    </div>
  );
};

// Memoize AIMessageBox to prevent re-renders during streaming
const AIMessageBox = React.memo(
  AIMessageBoxInternal,
  (prevProps, nextProps) => {
    // Performance optimization: shallow comparison of props
    // Only re-render if these critical props change

    const startTime = performance.now();

    // Message identity check
    if (prevProps.message.id !== nextProps.message.id) {
      return false; // Different message, re-render
    }

    // CRITICAL: During streaming, only re-render if content actually changed
    if (prevProps.isGenerating || nextProps.isGenerating) {
      // Check if message content changed
      const contentChanged =
        prevProps.message.content !== nextProps.message.content;

      // Check if streaming state changed (started/stopped)
      const streamingStateChanged =
        prevProps.isGenerating !== nextProps.isGenerating;

      // Only re-render if content or streaming state changed
      if (contentChanged || streamingStateChanged) {
        return false; // Re-render needed
      }
      return true; // Skip re-render
    }

    // Not streaming, check all critical props
    const sameContent = prevProps.message.content === nextProps.message.content;
    const sameParsed = prevProps.parsedContent === nextProps.parsedContent;
    const sameIsLastMessage =
      prevProps.isLastMessage === nextProps.isLastMessage;
    const sameHasNext =
      prevProps.hasNextAssistantMessage === nextProps.hasNextAssistantMessage;
    const sameResponseNumber =
      prevProps.responseNumber === nextProps.responseNumber;
    const sameSelectedOption =
      prevProps.message.selectedOption === nextProps.message.selectedOption;

    // Check if arrays/objects changed by reference (quick check)
    const sameClickedActions =
      prevProps.clickedActions === nextProps.clickedActions;
    const sameToolOutputs = prevProps.toolOutputs === nextProps.toolOutputs;
    const sameTerminalStatus =
      prevProps.terminalStatus === nextProps.terminalStatus;

    const shouldSkipRender =
      sameContent &&
      sameParsed &&
      sameIsLastMessage &&
      sameHasNext &&
      sameResponseNumber &&
      sameSelectedOption &&
      sameClickedActions &&
      sameToolOutputs &&
      sameTerminalStatus;

    const checkDuration = performance.now() - startTime;

    if (!shouldSkipRender) {
      const changedProps = [];
      if (!sameContent) changedProps.push("content");
      if (!sameParsed) changedProps.push("parsedContent");
      if (!sameIsLastMessage) changedProps.push("isLastMessage");
      if (!sameHasNext) changedProps.push("hasNextAssistantMessage");
      if (!sameResponseNumber) changedProps.push("responseNumber");
      if (!sameSelectedOption) changedProps.push("selectedOption");
      if (!sameClickedActions) changedProps.push("clickedActions");
      if (!sameToolOutputs) changedProps.push("toolOutputs");
      if (!sameTerminalStatus) changedProps.push("terminalStatus");
    }

    return shouldSkipRender; // true = skip re-render
  },
);

export default AIMessageBox;
