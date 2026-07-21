import React, { useState, useEffect } from "react";

// HOOKS
import { useProject } from "../../../../../context/ProjectContext";

// SERVICES
import { extensionService } from "../../../../../services/ExtensionService";

// CONSTANTS
import {
  shouldShowFileStats,
  shouldValidateFuzzyMatch,
  isToolClickable,
  TOOL_ACTION_TYPES,
  EXECUTION_STATUS,
} from "../../../constants/constants";

// TYPES
import { ToolAction } from "../../../services/ResponseParser";
import { Message } from "../../../types/message";

// UTILS
import { formatActionForDisplay } from "../../../services/ResponseParser";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import {
  WriteFileRenderer,
  ReplaceFileRenderer,
  ReadFileRenderer,
  ListFilesRenderer,
  FindFilesRenderer,
  GrepRenderer,
  DeleteRenderer,
  MoveFileRenderer,
  RevertFileRenderer,
  ViewReplaceHistoryRenderer,
  RunCommandRenderer,
  GitStatusRenderer,
  CommitMessageRenderer,
  MarkdownRenderer,
  QuestionRenderer,
  ErrorRenderer,
  WarningRenderer,
} from "./renderers";
import { GitDiffBlock } from "./blocks/git_diff/GitDiffBlock";
import ErrorBlock from "./blocks/error/ErrorBlock";
import { ToolHeader } from "./ToolHeader";
interface ToolRouterProps {
  group: { action: ToolAction; index: number }[];
  messageId: string;
  clickedActions: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    actionIndex: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  isActiveGroup?: boolean;
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: Record<
    string,
    { output: string; isError: boolean; terminalId?: string }
  >;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  allActions?: ToolAction[];
  conversationId?: string;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  onGitConfirm?: (statusItems: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
}

const ToolRouterInternal: React.FC<ToolRouterProps> = ({
  group,
  messageId,
  clickedActions,
  rejectedActions,
  onToolClick,
  executionState,
  isActiveGroup,
  failedActions,
  isLastMessage,
  isLastItemInList = true,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  allActions,
  conversationId,
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
  const { rootPath } = useProject();

  const [fuzzyStatus, setFuzzyStatus] = React.useState<{
    status: string;
    score?: number;
    startLine?: number;
  } | null>(null);
  const [fileStatsMap, setFileStatsMap] = React.useState<
    Record<string, { lines: number; loading: boolean }>
  >({});
  const [isPreviewing, setIsPreviewing] = React.useState<string | null>(null);
  const [storedOutput, setStoredOutput] = useState<string | null>(null);
  const [collapsedActions, setCollapsedActions] = useState<Set<string>>(
    new Set(),
  );
  const processedActions = React.useRef<Set<string>>(new Set());

  const toggleCollapse = (actionId: string) => {
    setCollapsedActions((prev) => {
      const next = new Set(prev);
      next.has(actionId) ? next.delete(actionId) : next.add(actionId);
      return next;
    });
  };

  const effectCollapsedCountRef = React.useRef(0);
  useEffect(() => {
    effectCollapsedCountRef.current += 1;
    const initialCollapsed = new Set<string>();
    group.forEach((item, index) => {
      const actionId = `${messageId}-action-${index}`;
      if (item.action.type !== "run_command") {
        initialCollapsed.add(actionId);
      }
    });
    setCollapsedActions(initialCollapsed);
  }, [group, messageId]);

  // Fetch terminal output from history
  const runCommandAction = group.find((g) => g.action.type === "run_command");
  useEffect(() => {
    if (!nextUserMessage?.content || !runCommandAction) return;
    const commandText = runCommandAction.action.params.command;
    if (!commandText) return;

    const escaped = commandText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `Output: \\[run_command for '${escaped}'.*?\\] .*?with "terminal_output-([a-f0-9-]+)"`,
    ).exec(nextUserMessage.content);

    if (match?.[1]) {
      const outputUuid = match[1];
      const requestId = `read-terminal-${outputUuid}`;
      if (processedActions.current.has(requestId) || storedOutput) return;

      const handleMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (
          msg.command === "readTerminalOutputResult" &&
          msg.outputUuid === outputUuid
        ) {
          if (msg.content) setStoredOutput(msg.content);
          window.removeEventListener("message", handleMessage);
        }
      };
      window.addEventListener("message", handleMessage);
      processedActions.current.add(requestId);
      extensionService.postMessage({
        command: "readTerminalOutput",
        chatUuid: conversationId || nextUserMessage.conversationId || "",
        outputUuid,
        requestId,
      });
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [
    nextUserMessage?.id,
    runCommandAction?.action.params.command,
    messageId,
    storedOutput,
  ]);

  // Validate fuzzy match & fetch file stats
  React.useEffect(() => {
    const _effectStartTime = performance.now();
    const cleanups: (() => void)[] = [];

    group.forEach((item) => {
      const { action, index } = item;
      const actionId = `${messageId}-action-${index}`;

      // Check if tool needs fuzzy match validation
      if (shouldValidateFuzzyMatch(action.type) && action.params.diff) {
        const validationId = `${messageId}-${index}-validate`;
        if (processedActions.current.has(validationId)) return;

        const handleMessage = (event: MessageEvent) => {
          const msg = event.data;
          if (
            msg.command === "validateFuzzyMatchResult" &&
            msg.id === validationId
          ) {
            setFuzzyStatus({
              status: msg.status,
              score: msg.score,
              startLine: msg.startLine,
            });
            window.removeEventListener("message", handleMessage);
          }
        };
        window.addEventListener("message", handleMessage);
        cleanups.push(() =>
          window.removeEventListener("message", handleMessage),
        );
        processedActions.current.add(validationId);
        (window as any).vscodeApi?.postMessage({
          command: "validateFuzzyMatch",
          path: action.params.path,
          diff: action.params.diff,
          id: validationId,
        });
      }

      // Check if tool needs file stats
      if (
        shouldShowFileStats(action.type) &&
        (action.params.path || action.params.file_path)
      ) {
        const path = action.params.path || action.params.file_path;
        if (fileStatsMap[path]) return;
        const statId = `${messageId}-${index}-stats`;
        if (processedActions.current.has(statId)) return;
        processedActions.current.add(statId);

        const handleStats = (event: MessageEvent) => {
          const msg = event.data;
          if (
            msg.command === "fileStatsResult" &&
            msg.id === statId &&
            msg.path === path
          ) {
            setFileStatsMap((prev) => ({
              ...prev,
              [path]: { lines: msg.lines, loading: false },
            }));
            window.removeEventListener("message", handleStats);
          }
        };
        window.addEventListener("message", handleStats);
        cleanups.push(() => window.removeEventListener("message", handleStats));
        (window as any).vscodeApi?.postMessage({
          command: "getFileStats",
          path,
          id: statId,
        });
      }
    });

    return () => cleanups.forEach((c) => c());
  }, [
    group,
    messageId,
    isActiveGroup,
    clickedActions,
    onToolClick,
    fileStatsMap,
  ]);

  if (!group || group.length === 0) return null;

  const firstAction = group[0].action;
  const toolType = firstAction.type;

  // Handle malformed/error tool actions - show ToolHeader + ErrorBlock
  if (firstAction.isError) {
    const errorColor = "var(--vscode-errorForeground, #f44336)";

    // Determine label based on tool type
    const toolLabelMap: Record<string, string> = {
      read_file: "READ",
      write_to_file: "WRITE",
      replace_in_file: "REPLACE",
      list_files: "LIST",
      find_files: "FIND",
      grep: "GREP",
      delete_file: "DELETE",
      delete_folder: "DELETE",
      move_file: "MOVE",
      revert_file: "REVERT",
      run_command: "RUN",
    };
    const toolLabel =
      toolLabelMap[toolType] ?? toolType.toUpperCase().replace(/_/g, " ");

    // Extract file path or relevant info from params
    const filePath =
      firstAction.params.file_path ||
      firstAction.params.folder_path ||
      firstAction.params.path ||
      "";
    const fileName = filePath ? filePath.split("/").pop() || filePath : "";

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          marginBottom: isLastItemInList ? "0" : "8px",
        }}
      >
        <ToolHeader
          title={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--vscode-editor-foreground)",
              }}
            >
              <span style={{ fontWeight: 600, opacity: 0.8 }}>{toolLabel}</span>
              {fileName && (
                <>
                  <span style={{ display: "flex", alignItems: "center" }}>
                    <FileIcon
                      path={filePath}
                      style={{ width: "16px", height: "16px" }}
                    />
                  </span>
                  <span
                    style={{
                      fontWeight: 500,
                      opacity: 0.9,
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                      fontSize: "11px",
                    }}
                  >
                    {fileName}
                  </span>
                </>
              )}
            </div>
          }
          path={filePath}
          statusColor={errorColor}
          isError={true}
          toolType={toolType}
        />
        <ErrorBlock
          content={firstAction.errorMessage || "Unknown error occurred"}
          errorCode={firstAction.errorCode}
          showHeader={false}
          maxHeight="300px"
        />
      </div>
    );
  }

  // Handle view_replace_history BEFORE isFileTool check
  if (toolType === "view_replace_history") {
    const filePath =
      firstAction.params.file_path || firstAction.params.path || "";
    const actionIndex = group[0].index;
    const actionId = `${messageId}-action-${actionIndex}`;
    const outputData = toolOutputs?.[actionId];
    const isError = outputData?.isError || false;
    const isCompleted = !!outputData; // No longer check isPartial since we don't use streaming parsing

    // Determine color based on status
    const historyColor = isError
      ? "var(--vscode-errorForeground, #ff4d4d)"
      : isCompleted
        ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
        : "var(--vscode-textLink-foreground, #9370db)";

    // Parse histories from output
    let histories: any[] = [];
    try {
      if (outputData?.output && typeof outputData.output === "string") {
        if (outputData.output === "No history") {
          histories = [];
        } else {
          histories = JSON.parse(outputData.output);
        }
      }
    } catch (e) {
      // Ignore parse error - histories will remain empty array
    }

    // Summary result for ToolHeader
    const summaryResult =
      isCompleted && !isError && histories.length > 0
        ? `${histories.length} ${histories.length === 1 ? "version" : "versions"}`
        : undefined;

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          marginBottom: isLastItemInList ? "0" : "8px",
        }}
      >
        <ToolHeader
          title={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--vscode-editor-foreground)",
              }}
            >
              <span style={{ fontWeight: 600, opacity: 0.8 }}>HISTORY</span>
              <span style={{ display: "flex", alignItems: "center" }}>
                <FileIcon
                  path={filePath}
                  isFolder={false}
                  style={{ width: "16px", height: "16px" }}
                />
              </span>
              <span
                style={{
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  fontWeight: 500,
                  opacity: 0.9,
                }}
              >
                {filePath.split("/").pop() || filePath}
              </span>
              {summaryResult && (
                <span
                  style={{
                    opacity: 0.5,
                    fontSize: "10px",
                    color: "var(--vscode-descriptionForeground)",
                  }}
                >
                  {summaryResult}
                </span>
              )}
            </div>
          }
          path={filePath}
          statusColor={historyColor}
          isPartial={false}
          isError={isError}
          toolType="view_replace_history"
          tooltipMeta={{
            fileCount: histories.length,
          }}
        />
        {isError && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "var(--vscode-inputValidation-errorBackground)",
              border: "1px solid var(--vscode-inputValidation-errorBorder)",
              borderRadius: "4px",
              color: "var(--vscode-errorForeground)",
              fontSize: "12px",
              marginTop: "8px",
            }}
          >
            {outputData?.output || "Failed to load history"}
          </div>
        )}
      </div>
    );
  }

  if (toolType === "write_to_file") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <WriteFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
        singleLineReviewActions={singleLineReviewActions}
        onConfirmSingleLineAction={onConfirmSingleLineAction}
        onRejectSingleLineAction={onRejectSingleLineAction}
      />
    );
  }

  if (toolType === "replace_in_file") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <ReplaceFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
        mergedItems={group}
      />
    );
  }

  if (toolType === "run_command") {
    return (
      <RunCommandRenderer
        action={firstAction}
        actionIndex={group[0].index}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${group[0].index}`,
        )}
        isRejected={rejectedActions?.has(
          `${messageId}-action-${group[0].index}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        nextUserMessage={nextUserMessage}
        rootPath={rootPath}
        onToolClick={onToolClick}
        storedOutput={storedOutput}
      />
    );
  }

  if (toolType === "git_status") {
    // Use props gitStatusItems if available, otherwise parse from action params
    let finalGitStatusItems = gitStatusItems;
    if (!finalGitStatusItems || finalGitStatusItems.length === 0) {
      let itemsFromParams = firstAction.params?.items || [];
      if (typeof itemsFromParams === "string") {
        try {
          itemsFromParams = JSON.parse(itemsFromParams);
        } catch (e) {
          itemsFromParams = [];
        }
      }
      finalGitStatusItems = itemsFromParams;
    }
    return (
      <GitStatusRenderer
        action={firstAction}
        actionIndex={group[0].index}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${group[0].index}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        onToolClick={onToolClick}
        gitStatusItems={finalGitStatusItems}
        branch={gitStatusBranch}
        isProcessing={isGitProcessing || executionState?.status === "running"}
        onConfirm={onGitConfirm}
        onCancel={onGitCancel}
        isVisible={isGitStatusVisible}
      />
    );
  }

  if (toolType === "commit_message") {
    const messageContent =
      firstAction.params?.message || firstAction.params?.content || "";
    const actionIndex = group[0].index;
    const actionId = `${messageId}-action-${actionIndex}`;
    const isRejected = rejectedActions?.has(actionId) || false;
    const [isCommitted, setIsCommitted] = React.useState(false);
    const statusColor = isRejected
      ? "var(--vscode-errorForeground, #ff4d4d)"
      : isCommitted
        ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
        : "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)";

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div
          className="terminal-block commit-message-tool"
          style={{ marginBottom: isLastItemInList ? "0" : "8px" }}
        >
          <ToolHeader
            title={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--vscode-editor-foreground)",
                }}
              >
                <span style={{ fontWeight: 600, opacity: 0.8 }}>
                  COMMIT MESSAGE{gitStatusBranch ? `(${gitStatusBranch})` : ""}
                </span>
                <span
                  className="codicon codicon-git-commit"
                  style={{ fontSize: "14px" }}
                />
                {isRejected && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--vscode-errorForeground, #ff4d4d)",
                      background:
                        "color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      marginLeft: "4px",
                    }}
                  >
                    REJECTED
                  </span>
                )}
                {isCommitted && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color:
                        "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
                      background:
                        "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 15%, transparent)",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      marginLeft: "4px",
                    }}
                  >
                    ✓ COMMITTED
                  </span>
                )}
              </div>
            }
            statusColor={statusColor}
            isPartial={false}
          />
          <div style={{ padding: "4px 12px 12px 0" }}>
            <div
              style={{
                padding: "12px 14px",
                background: "var(--vscode-editor-background, #1e1e1e)",
                borderRadius: "6px",
                border: "1px solid var(--vscode-widget-border, #454545)",
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: "13px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--vscode-foreground, #cccccc)",
                maxHeight: "auto",
                overflowY: "visible",
              }}
            >
              {messageContent}
              {isCommitted && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px 14px",
                    background:
                      "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 10%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 30%, transparent)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "var(--vscode-foreground)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color:
                        "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
                      marginBottom: "4px",
                    }}
                  >
                    Commit thành công!
                  </div>
                  <div style={{ opacity: 0.8, fontSize: "11px" }}>
                    Hãy chạy{" "}
                    <code
                      style={{
                        background: "var(--vscode-textCodeBlock-background)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontFamily:
                          "var(--vscode-editor-font-family, monospace)",
                        fontSize: "11px",
                      }}
                    >
                      git push
                    </code>{" "}
                    để đẩy commit lên remote.
                  </div>
                </div>
              )}
            </div>
            {!isCommitted && !isRejected && (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  padding: "8px 0 4px 0",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => {
                    const vscodeApi = (window as any).vscodeApi;
                    if (vscodeApi) {
                      setIsCommitted(true);
                      vscodeApi.postMessage({
                        command: "acceptCommitMessage",
                        message: messageContent,
                      });
                    }
                  }}
                  style={{
                    background: `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 15%, transparent)`,
                    color:
                      "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)",
                    border: `1px solid color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 30%, transparent)`,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "24px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 25%, transparent)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 15%, transparent)`;
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Accept
                </button>
                <button
                  onClick={() => {
                    // Mark action as rejected locally
                    onToolClick(firstAction, messageId, actionIndex, "reject");
                    // Also notify extension
                    const vscodeApi = (window as any).vscodeApi;
                    if (vscodeApi) {
                      vscodeApi.postMessage({
                        command: "rejectCommitMessage",
                      });
                    }
                  }}
                  style={{
                    background: `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)`,
                    color: "var(--vscode-errorForeground, #ff4d4d)",
                    border: `1px solid color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 30%, transparent)`,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: isRejected ? "default" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "24px",
                    opacity: isRejected ? 0.5 : 1,
                  }}
                  disabled={isRejected}
                  onMouseEnter={(e) => {
                    if (!isRejected) {
                      e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 25%, transparent)`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRejected) {
                      e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)`;
                    }
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                  {isRejected ? "Rejected" : "Reject"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (toolType === "git_diff") {
    const filePath = firstAction.params.file_path || "";
    const actionIndex = group[0].index;
    const actionId = `${messageId}-action-${actionIndex}`;

    // Check if we already have the diff result in toolOutputs
    const outputData = toolOutputs?.[actionId];
    const diffContent = outputData?.output || firstAction.params.diff || "";
    const hasOutput = !!outputData && !outputData.isError;

    // Auto-execute the tool if not yet executed and it's the active group
    const hasTriggeredExecution = React.useRef(false);
    React.useEffect(() => {
      if (
        !hasTriggeredExecution.current &&
        !hasOutput &&
        isActiveGroup &&
        !isLastMessage
      ) {
        hasTriggeredExecution.current = true;
        onToolClick(firstAction, messageId, actionIndex, "accept");
      }
    }, [hasOutput, isActiveGroup, isLastMessage, actionId]);

    // Parse diff stats from the diff content
    const parseDiffStats = (content: string) => {
      let added = 0;
      let deleted = 0;
      if (!content) return { added: 0, deleted: 0 };
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) added++;
        if (line.startsWith("-") && !line.startsWith("---")) deleted++;
      }
      return { added, deleted };
    };

    const stats = parseDiffStats(diffContent);

    // If no output yet and we're not the active group, show a loading/skeleton state
    if (!hasOutput && !isActiveGroup) {
      return (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <GitDiffBlock
            filePath={filePath}
            diffContent=""
            added={0}
            deleted={0}
            statusColor="var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
            isPartial={true}
            branch={gitStatusBranch}
            onFileClick={(path: any) => {
              const vscodeApi = (window as any).vscodeApi;
              if (vscodeApi) {
                vscodeApi.postMessage({
                  command: "openFile",
                  path,
                });
              }
            }}
          />
        </div>
      );
    }

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <GitDiffBlock
          filePath={filePath}
          diffContent={diffContent}
          added={stats.added}
          deleted={stats.deleted}
          statusColor="var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
          isPartial={!hasOutput && isActiveGroup}
          branch={gitStatusBranch}
          onFileClick={(path: any) => {
            const vscodeApi = (window as any).vscodeApi;
            if (vscodeApi) {
              vscodeApi.postMessage({
                command: "openFile",
                path,
              });
            }
          }}
        />
      </div>
    );
  }

  // Handle read_file tool type
  if (toolType === "read_file") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <ReadFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
      />
    );
  }

  // Handle list_files tool type
  if (toolType === "list_files") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <ListFilesRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
      />
    );
  }

  // Handle find_files tool type
  if (toolType === "find_files") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <FindFilesRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
      />
    );
  }

  // Handle grep tool type
  if (toolType === "grep") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <GrepRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
      />
    );
  }

  // Handle delete_file and delete_folder tool types
  if (toolType === "delete_file" || toolType === "delete_folder") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <DeleteRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
      />
    );
  }

  // Handle move_file tool type
  if (toolType === "move_file") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <MoveFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
      />
    );
  }

  // Handle revert_file tool type
  if (toolType === "revert_file") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <RevertFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
      />
    );
  }

  // Fallback for non-styled tools
  return (
    <>
      {group.map(({ action, index }) => (
        <div key={index} style={{ marginBottom: "8px" }}>
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              border: "2px solid var(--vscode-descriptionForeground, #6b7280)",
              borderRadius: "var(--border-radius-lg)",
              cursor: isToolClickable(action.type) ? "pointer" : "default",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              width: "fit-content",
            }}
            onClick={() => {
              if (isToolClickable(action.type))
                onToolClick(action, messageId, index, "accept");
            }}
          >
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
                fontWeight: 600,
                flex: 1,
              }}
            >
              {formatActionForDisplay(action)}
            </span>
            {isToolClickable(action.type) && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--vscode-descriptionForeground, #6b7280)"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </>
  );
};

// ============================================
// ToolActionsList Component (from ToolAction.tsx)
// ============================================

interface ToolActionsListProps {
  message: Message;
  items: { action: ToolAction; index: number }[];
  clickedActions: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: ToolAction | ToolAction[],
    message: Message,
    actionIndex: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  isVisibleTool?: (type: string) => boolean;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  conversationId?: string;
  allActions?: ToolAction[];
  isBlockedByPrecedingInteraction?: boolean;
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

const ToolActionsList: React.FC<ToolActionsListProps> = ({
  message,
  items,
  clickedActions,
  rejectedActions,
  onToolClick,
  executionState,
  failedActions,
  isLastMessage,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  conversationId,
  allActions,
  isBlockedByPrecedingInteraction = false,
  isVisibleTool = (type: string) => true,
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
  // Filter out invisible tools immediately
  const visibleItems = React.useMemo(() => {
    return items.filter((item) => isVisibleTool(item.action.type));
  }, [items, isVisibleTool]);

  // Memoize action handlers to prevent unnecessary re-renders
  const memoizedActions = React.useMemo(() => {
    const MERGE_TYPES = new Set(["write_to_file", "replace_in_file"]);
    const getPath = (action: ToolAction) =>
      action.params.file_path || action.params.path || "";

    const groups: { action: ToolAction; index: number }[][] = [];
    visibleItems.forEach((item) => {
      const last = groups[groups.length - 1];
      if (
        last &&
        MERGE_TYPES.has(item.action.type) &&
        MERGE_TYPES.has(last[0].action.type) &&
        getPath(item.action) === getPath(last[0].action)
      ) {
        last.push(item);
      } else {
        groups.push([item]);
      }
    });

    return groups.map((group, groupIdx) => {
      const firstItem = group[0];
      const key = `group-${firstItem.index}`;

      let isPreviousAllDone = true;
      for (let i = 0; i < firstItem.index; i++) {
        const actionId = `${message.id}-action-${i}`;
        const hasOutput = toolOutputs && toolOutputs[actionId];
        const isClicked = clickedActions.has(actionId);

        // If there's a user message after this assistant message,
        // or a message in history containing the output of this action, it is completed.
        const hasHistoryOutput =
          !!nextUserMessage ||
          !!allMessages?.some((m) => m.actionIds?.includes(actionId));

        // Check if this action is completed (clicked, has output, or history output)
        const isCompleted = isClicked || hasOutput || hasHistoryOutput;

        if (!isCompleted) {
          const action = allActions ? allActions[i] : null;
          const isWriteTool =
            action &&
            (action.type === "write_to_file" ||
              action.type === "replace_in_file");

          if (isWriteTool && !hasHistoryOutput) {
            // Write/edit tool not yet approved → block subsequent tools
            isPreviousAllDone = false;
            break;
          }
          // For non-write tools (read, run_command, etc.), block as usual
          if (!isWriteTool) {
            isPreviousAllDone = false;
            break;
          }
        }

        // If it's a run_command, check if it's actually finished
        const action = allActions ? allActions[i] : null;
        if (action && action.type === "run_command") {
          const output = toolOutputs?.[actionId];
          const terminalId =
            (output as any)?.terminalId || action.params.terminal_id;
          if (
            terminalId &&
            terminalStatus?.[terminalId] === "busy" &&
            !hasHistoryOutput
          ) {
            isPreviousAllDone = false;
            break;
          }
        }
      }

      const isThisActionClicked = clickedActions.has(
        `${message.id}-action-${firstItem.index}`,
      );

      const isActiveGroup =
        isLastMessage &&
        isPreviousAllDone &&
        !isThisActionClicked &&
        !isBlockedByPrecedingInteraction;

      return (
        <React.Fragment key={key}>
          <ToolRouterInternal
            group={group}
            messageId={message.id}
            clickedActions={clickedActions}
            rejectedActions={rejectedActions}
            onToolClick={(act, msgId, aIdx, type) =>
              onToolClick(act, message, aIdx, type)
            }
            executionState={executionState}
            isActiveGroup={isActiveGroup}
            failedActions={failedActions}
            isLastMessage={isLastMessage}
            isLastItemInList={groupIdx === groups.length - 1}
            toolOutputs={toolOutputs}
            terminalStatus={terminalStatus}
            nextUserMessage={nextUserMessage}
            allMessages={allMessages}
            conversationId={conversationId}
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
        </React.Fragment>
      );
    });
  }, [
    items,
    clickedActions,
    message,
    onToolClick,
    isLastMessage,
    toolOutputs,
    terminalStatus,
    nextUserMessage,
  ]);

  if (!visibleItems || visibleItems.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {memoizedActions}
    </div>
  );
};

export default ToolActionsList;
