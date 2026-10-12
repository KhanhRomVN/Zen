import React from "react";

// HOOKS
import { useSettings } from "../../../../../../context/SettingsContext";

// SERVICES
import { extensionService } from "../../../../../../services/ExtensionService";

// CONSTANTS
import {
  TOOL_ACTION_TYPES,
  TERMINAL_STATUS,
  type TerminalStatus,
  getToolLabel,
} from "../../../../constants/constants";

// TYPES
import { ToolAction } from "../../../../services/ResponseParser";
import { Message } from "../../../../types/message";

// UTILS
import { getPermissionDecision } from "../../../../utils/permissionUtils";

// ICONS
import { ShieldAlert } from "lucide-react";
import { getFolderIconPath } from "@/utils/fileIconMapper";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import { TerminalBlock } from "../blocks/run_command/TerminalBlock";
import ActionBar from "../ActionBar";
import ErrorBlock from "../blocks/error/ErrorBlock";

interface RunCommandRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked: boolean;
  isRejected?: boolean;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  toolOutputs?: Record<
    string,
    { output: string; isError: boolean; terminalId?: string }
  >;
  terminalStatus?: Record<string, TerminalStatus>;
  nextUserMessage?: Message;
  rootPath?: string;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    index: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  storedOutput?: string | null;
  isDisplayOnly?: boolean;
  /** Dangerous command warning info (if detected) */
  dangerousCommand?: {
    actionId: string;
    commandText: string;
    folderPath?: string;
    reason: string;
  };
  onProceedDangerousCommand?: (actionId: string) => void;
  onCancelDangerousCommand?: (actionId: string) => void;
}

export const RunCommandRenderer: React.FC<RunCommandRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isRejected: isRejectedProp,
  isActiveGroup,
  isLastMessage,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  rootPath,
  onToolClick,
  storedOutput,
  isDisplayOnly = false,
  dangerousCommand,
  onProceedDangerousCommand,
  onCancelDangerousCommand,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isRejectedLocal, setIsRejectedLocal] = React.useState(false);
  const { permissionMode } = useSettings();
  const actionId = `${messageId}-action-${actionIndex}`;
  const outputData = toolOutputs?.[actionId];

  // Detect rejection from output message or local state
  const isRejectedFromOutput = outputData?.output?.includes("rejected by user");
  const isRejected = isRejectedProp || isRejectedLocal || isRejectedFromOutput;

  // Listen for markActionRejected window messages (fired by useToolExecution)
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.data?.command === "markActionRejected" &&
        event.data?.actionId === actionId
      ) {
        setIsRejectedLocal(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [actionId]);

  // Check if action has validation error
  const hasValidationError = !!action.isError;

  const needsPrompt =
    getPermissionDecision(permissionMode, "run_command") === "confirm";
  const commandText = action.params.command || "";

  const folderPath =
    action.params.folder_path || action.params.cwd || rootPath || "";

  // Determine if folderPath is within workspace (relative) or outside (system path)
  const isRelativePath = rootPath && folderPath.startsWith(rootPath);
  const displayFolderPath = isRelativePath
    ? folderPath.substring(rootPath.length).replace(/^\//, "") || "."
    : folderPath;
  const folderName = folderPath
    ? folderPath.split("/").filter(Boolean).pop() || folderPath
    : "";

  let extractedOutput: string | undefined;
  if (!outputData?.output && nextUserMessage?.content) {
    if (commandText) {
      const escaped = commandText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(
        `Output: \\[run_command for '${escaped}'.*?\\][^\\n]*\\n\\s*\`\`\`\\n([\\s\\S]*?)\\n\\s*\`\`\``,
      ).exec(nextUserMessage.content);
      if (match?.[1]) extractedOutput = match[1];
    }
  }

  const terminalId =
    (outputData as any)?.terminalId || action.params.terminal_id;
  const hasOutput = !!outputData || !!extractedOutput || !!storedOutput;

  const isTerminalBusy = isDisplayOnly
    ? false // display-only: không có terminal thật, không busy
    : !isRejected &&
      (hasOutput
        ? terminalStatus?.[terminalId] === TERMINAL_STATUS.BUSY
        : terminalId
          ? terminalStatus?.[terminalId] === TERMINAL_STATUS.BUSY ||
            (isActionClicked && terminalStatus?.[terminalId] === undefined)
          : isActionClicked);

  const isLoading = isActionClicked && (!hasOutput || isTerminalBusy);
  const isCompleted = isDisplayOnly ? true : hasOutput && !isTerminalBusy;

  // Calculate execution time (if completed)
  const [executionTime, setExecutionTime] = React.useState<string>("");
  React.useEffect(() => {
    if (isCompleted && outputData) {
      // Try to extract time from output or calculate from timestamps if available
      // For now, we'll just show "completed" without time
      // This can be enhanced later if we track start/end times
      setExecutionTime("");
    }
  }, [isCompleted, outputData]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingBottom: "4px",
        marginBottom: "2px",
      }}
    >
      <TagHeader
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--vscode-editor-foreground)",
              flex: 1,
            }}
          >
            <span style={{ fontWeight: 600, opacity: 0.8, flexShrink: 0 }}>
              {getToolLabel("run_command")}
            </span>
            {folderName && (
              <>
                <img
                  src={getFolderIconPath(folderPath)}
                  alt=""
                  style={{ width: "14px", height: "14px", flexShrink: 0 }}
                />
                <span
                  style={{
                    fontWeight: 500,
                    opacity: 0.8,
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                    fontSize: "11px",
                    flexShrink: 0,
                  }}
                >
                  {folderName}
                </span>
              </>
            )}
            {isCompleted && executionTime && (
              <span
                style={{
                  opacity: 0.5,
                  fontSize: "10px",
                  color: "var(--vscode-descriptionForeground)",
                  flexShrink: 0,
                }}
              >
                {executionTime}
              </span>
            )}
          </div>
        }
        statusColor={
          isRejected
            ? "var(--vscode-errorForeground)"
            : isDisplayOnly || isCompleted
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : isTerminalBusy || (isActionClicked && !outputData)
                ? "var(--vscode-editorWarning-foreground, #e3b341)"
                : isActiveGroup
                  ? "var(--vscode-descriptionForeground)"
                  : "var(--vscode-descriptionForeground)"
        }
        isError={isRejected}
        isWaitingApproval={
          !isDisplayOnly && !!isActiveGroup && !isCompleted && !isTerminalBusy
        }
        toolType="run_command"
        isPartial={isTerminalBusy}
        path={displayFolderPath}
        onPathClick={(clickedPath) => {
          extensionService.postMessage({
            command: "openFile",
            path:
              isRelativePath && rootPath
                ? `${rootPath}/${clickedPath}`
                : clickedPath,
          });
        }}
        onClick={() => {
          if (isCompleted || hasOutput) setIsCollapsed((v) => !v);
        }}
      />

      {/* ─── Main Content Area ─── */}
      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          style={{
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "12px",
            color: "var(--vscode-terminal-foreground, #cccccc)",
            padding: "6px 10px",
            backgroundColor: "var(--vscode-terminal-background, #1e1e1e)",
            border: "1px solid var(--vscode-panel-border, rgba(128,128,128,0.2))",
            borderRadius: "6px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            cursor: "pointer",
            lineHeight: "1.5",
          }}
        >
          {commandText}
        </div>
      ) : isRejected ? (
        <TerminalBlock
          logs=""
          initialCommand={action.params.command}
          cwd={action.params.cwd || rootPath}
          rejectedOutline
        />
      ) : (
        <>
          {/* 1. Always show Terminal Block first to keep UI consistent */}
          <TerminalBlock
            logs={
              isDisplayOnly
                ? "Lệnh này đã được thực thi bởi AI trong môi trường sandbox và không chạy cục bộ."
                : outputData?.output || extractedOutput || storedOutput || ""
            }
            initialCommand={action.params.command}
            cwd={action.params.cwd || rootPath}
            onInput={
              isTerminalBusy
                ? (data: any) => {
                    if (terminalId)
                      extensionService.postMessage({
                        command: "terminalInput",
                        terminalId,
                        data,
                      });
                  }
                : undefined
            }
          />

          {/* 2. Dangerous Command Warning & Actions (Inserted below Terminal) */}
          {dangerousCommand && !isCompleted && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                backgroundColor:
                  "color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 5%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 22%, transparent)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px 12px",
              }}
            >
              {/* Icon + message */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  flex: "1 1 200px",
                  minWidth: 0,
                }}
              >
                <ShieldAlert
                  size={14}
                  strokeWidth={2}
                  style={{
                    color: "var(--vscode-editorWarning-foreground, #e3b341)",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    lineHeight: 1.5,
                    color: "var(--vscode-foreground)",
                    opacity: 0.85,
                  }}
                >
                  Review this command carefully before running it.
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
                {/* Cancel: ghost button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelDangerousCommand?.(dangerousCommand.actionId);
                  }}
                  style={{
                    background: "transparent",
                    color: "var(--vscode-descriptionForeground, #8b8b8b)",
                    border:
                      "1px solid var(--vscode-widget-border, rgba(128,128,128,0.25))",
                    cursor: "pointer",
                    padding: "0 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    height: "24px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(128,128,128,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Cancel
                </button>

                {/* Accept risk: soft warning-tinted button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onProceedDangerousCommand?.(dangerousCommand.actionId);
                  }}
                  style={{
                    background:
                      "color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 14%, transparent)",
                    color: "var(--vscode-editorWarning-foreground, #e3b341)",
                    border:
                      "1px solid color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 30%, transparent)",
                    cursor: "pointer",
                    padding: "0 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    height: "24px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 24%, transparent)";
                    e.currentTarget.style.borderColor =
                      "color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 45%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 14%, transparent)";
                    e.currentTarget.style.borderColor =
                      "color-mix(in srgb, var(--vscode-editorWarning-foreground, #e3b341) 30%, transparent)";
                  }}
                >
                  Accept risk
                </button>
              </div>
            </div>
          )}

          {/* 3. Standard Busy State Controls */}
          {isTerminalBusy && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "4px",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  extensionService.postMessage({
                    command: "closeTerminal",
                    actionId,
                    terminalId,
                  });
                }}
                title="Hoàn tất đầu ra, kết thúc tiến trình và xóa terminal"
                style={{
                  background:
                    "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 10%, transparent)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--vscode-errorForeground, #f44336)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 600,
                  gap: "6px",
                  height: "24px",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
                Hoàn tất
              </button>
            </div>
          )}

          {/* 4. Default ActionBar (Hidden if dangerousCommand is active/pending) */}
          {!dangerousCommand && needsPrompt &&
            !isTerminalBusy &&
            !isCompleted &&
            !hasValidationError && (
              <ActionBar
                action={action}
                messageId={messageId}
                actionIndex={actionIndex}
                hasError={hasValidationError}
                isCompleted={isCompleted}
                isLoading={isLoading}
                onAction={(e, type) => {
                  if (!isCompleted && !isLoading) {
                    onToolClick(
                      {
                        ...action,
                        params: { ...action.params, terminal_id: terminalId },
                      },
                      messageId,
                      actionIndex,
                      type,
                    );
                  }
                }}
              />
            )}
        </>
      )}
      {hasValidationError && action.errorMessage && (
        <ErrorBlock
          content={`Validation Error: ${action.errorMessage}`}
          compact={true}
          maxHeight="300px"
        />
      )}
    </div>
  );
};
