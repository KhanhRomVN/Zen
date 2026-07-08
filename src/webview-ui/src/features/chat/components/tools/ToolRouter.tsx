import React, { useState, useEffect } from "react";
import { ToolAction } from "../../services/ResponseParser";
import { formatActionForDisplay } from "../../services/ResponseParser";
import { getToolColor } from "../../utils/toolUtils";
import { CLICKABLE_TOOLS } from "../../constants/constants";
import {
  isFileTool as checkIsFileTool,
  shouldShowFileStats,
  shouldValidateFuzzyMatch,
} from "../../constants/tool-registry";
import { extensionService } from "../../../../services/ExtensionService";
import { Message } from "../../types/message";
import { useProject } from "../../../../context/ProjectContext";
import FileToolRenderer from "./FileToolRenderer";
import TerminalToolRenderer from "./TerminalToolRenderer";
import GitToolRenderer from "./GitToolRenderer";
import { ToolHeader } from "./ToolHeader";
import { GitDiffBlock } from "../blocks/git_diff/GitDiffBlock";
import { ToolOutputs } from "../../types/tool-outputs";
import ContextCompressionBlock from "../blocks/context_compression/ContextCompressionBlock";

interface ToolRouterProps {
  group: { action: ToolAction; index: number }[];
  messageId: string;
  clickedActions: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    actionIndex: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
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
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
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

const ToolRouter: React.FC<ToolRouterProps> = ({
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
  activeTerminalIds,
  attachedTerminalIds,
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

  useEffect(() => {
    const initialCollapsed = new Set<string>();
    group.forEach((item, index) => {
      const actionId = `${messageId}-action-${index}`;
      if (item.action.type !== "run_command" && !item.action.isPartial) {
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
  const toolColor = getToolColor(toolType);
  const clickableTools = CLICKABLE_TOOLS;
  const isFileTool = checkIsFileTool(toolType);

  if (toolType === "write_to_file") {
    const action = firstAction;
    const actionIndex = group[0].index;
    return (
      <FileToolRenderer
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
      <FileToolRenderer
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

  if (isFileTool) {
    const MERGE_TYPES = new Set(["write_to_file", "replace_in_file"]);
    const getPath = (a: ToolAction) =>
      a.params.file_path || a.params.path || "";
    const isMergedGroup =
      group.length > 1 &&
      group.every((item) => MERGE_TYPES.has(item.action.type)) &&
      group.every((item) => getPath(item.action) === getPath(group[0].action));

    if (isMergedGroup) {
      return (
        <FileToolRenderer
          key={group[0].index}
          action={group[0].action}
          actionIndex={group[0].index}
          messageId={messageId}
          isActionClicked={group.every((item) =>
            clickedActions.has(`${messageId}-action-${item.index}`),
          )}
          isActiveGroup={isActiveGroup}
          isLastMessage={isLastMessage}
          isLastItemInList={isLastItemInList}
          toolOutputs={toolOutputs}
          allMessages={allMessages}
          fileStatsMap={fileStatsMap}
          onToolClick={onToolClick}
          mergedItems={group}
          conversationId={conversationId}
          singleLineReviewActions={singleLineReviewActions}
          onConfirmSingleLineAction={onConfirmSingleLineAction}
          onRejectSingleLineAction={onRejectSingleLineAction}
        />
      );
    }

    return (
      <>
        {group.map((item, idx) => (
          <FileToolRenderer
            key={item.index}
            action={item.action}
            actionIndex={item.index}
            messageId={messageId}
            isActionClicked={clickedActions.has(
              `${messageId}-action-${item.index}`,
            )}
            isActiveGroup={isActiveGroup}
            isLastMessage={isLastMessage}
            isLastItemInList={idx === group.length - 1 && isLastItemInList}
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
            singleLineReviewActions={singleLineReviewActions}
            onConfirmSingleLineAction={onConfirmSingleLineAction}
            onRejectSingleLineAction={onRejectSingleLineAction}
          />
        ))}
      </>
    );
  }

  if (toolType === "run_command") {
    return (
      <TerminalToolRenderer
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
      <GitToolRenderer
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
    const commitColor = getToolColor("commit_message");
    const isRejected = rejectedActions?.has(actionId) || false;
    const [isCommitted, setIsCommitted] = React.useState(false);
    const statusColor = isRejected
      ? "var(--vscode-errorForeground, #ff4d4d)"
      : isCommitted
        ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
        : commitColor;

    return (
      <div
        className="timeline-item"
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
          <div style={{ padding: "4px 12px 12px 29px" }}>
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

  if (toolType === "context_compression") {
    const summary = firstAction.params?.summary || "";
    const actionIndex = group[0].index;
    const actionId = `${messageId}-action-${actionIndex}`;
    const compressionColor = getToolColor("context_compression");
    const isRejected = rejectedActions?.has(actionId) || false;
    const [isAccepted, setIsAccepted] = React.useState(false);
    const statusColor = isRejected
      ? "var(--vscode-errorForeground, #ff4d4d)"
      : isAccepted
        ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
        : compressionColor;
    
    const isStreaming = firstAction.isPartial;

    return (
      <div
        className="timeline-item"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div
          className="terminal-block context-compression-tool"
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
                  position: "relative",
                  width: "100%",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    opacity: 0.8,
                    cursor: "pointer",
                    transition: "text-decoration 0.15s",
                  }}
                >
                  CONTEXT SUMMARY
                </span>
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
                {isAccepted && (
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
                    ✓ CONFIRMED
                  </span>
                )}
                {isStreaming && (
                  <span
                    style={{
                      fontSize: "10px",
                      opacity: 0.55,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      className="codicon codicon-loading codicon-modifier-spin"
                      style={{ fontSize: "10px" }}
                    />
                    Generating...
                  </span>
                )}
              </div>
            }
            statusColor={statusColor}
            isPartial={isStreaming}
            statusTooltip={
              isRejected
                ? "Rejected"
                : isAccepted
                  ? "✓ Confirmed"
                  : isStreaming
                    ? "Generating context summary..."
                    : "Context summary ready"
            }
          />
          
          <ContextCompressionBlock
            summary={summary}
            isStreaming={isStreaming}
            isAccepted={isAccepted}
            isRejected={isRejected}
            onConfirm={(summaryText) => {
              setIsAccepted(true);
              // Send message to extension to navigate home with summary
              const vscodeApi = (window as any).vscodeApi;
              if (vscodeApi) {
                vscodeApi.postMessage({
                  command: "acceptContextCompression",
                  summary: summaryText,
                });
              }
            }}
            onReject={() => {
              onToolClick(firstAction, messageId, actionIndex, "reject");
            }}
          />
        </div>
      </div>
    );
  }

  if (toolType === "git_diff") {
    const filePath = firstAction.params.file_path || "";
    const diffColor = getToolColor("git_diff");
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
        onToolClick(firstAction, messageId, actionIndex, "accept_once");
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

    // Determine if there are actions after this one (for timeline line)
    // Use "timeline-item" always — let CSS handle line drawing via padding-bottom

    // If no output yet and we're not the active group, show a loading/skeleton state
    if (!hasOutput && !isActiveGroup) {
      return (
        <div
          className="timeline-item"
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
            statusColor={diffColor}
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
        className="timeline-item"
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
          statusColor={diffColor}
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

  // Fallback for non-styled tools
  return (
    <>
      {group.map(({ action, index }) => (
        <div key={index} style={{ marginBottom: "8px" }}>
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              border: `2px solid ${toolColor}`,
              borderRadius: "var(--border-radius-lg)",
              cursor: clickableTools.includes(action.type)
                ? "pointer"
                : "default",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              width: "fit-content",
            }}
            onClick={() => {
              if (clickableTools.includes(action.type))
                onToolClick(action, messageId, index, "accept_once");
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
            {clickableTools.includes(action.type) && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={toolColor}
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

export default ToolRouter;
