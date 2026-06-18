import React from "react";
import { ToolAction } from "../../../../services/ResponseParser";
import { TerminalBlock } from "../TerminalBlock";
import { getToolColor } from "../../../../utils/utils";
import { extensionService } from "../../../../../../services/ExtensionService";
import { Message } from "../../../../types";
import ExecuteButton from "./ExecuteButton";
import { useI18n } from "../../../../../../hooks/useI18n";
import { useSettings } from "../../../../../../context/SettingsContext";
import { getPermissionDecision } from "../../../../hooks/useToolExecution";

interface TerminalToolItemProps {
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
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  rootPath?: string;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    index: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  storedOutput?: string | null;
}

const TerminalToolItem: React.FC<TerminalToolItemProps> = ({
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
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isRejectedLocal, setIsRejectedLocal] = React.useState(false);
  const { t } = useI18n();
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
  }, [messageId, actionIndex]);
  const needsPrompt =
    getPermissionDecision(permissionMode, "run_command") === "prompt";
  const commandText = action.params.command || "";
  const displayCommand =
    commandText.length > 50
      ? `${commandText.substring(0, 48)}...`
      : commandText;

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
  const isTerminalBusy =
    !isRejected &&
    (hasOutput
      ? terminalStatus?.[terminalId] === "busy"
      : terminalId
        ? terminalStatus?.[terminalId] === "busy" ||
          (isActionClicked && terminalStatus?.[terminalId] === undefined)
        : isActionClicked);
  const isLoading = isActionClicked && (!hasOutput || isTerminalBusy);
  const isCompleted = hasOutput && !isTerminalBusy;
  const toolColor = getToolColor("run_command");
  const dotColor = isRejected
    ? "var(--vscode-errorForeground, #ff4d4d)"
    : isCompleted
      ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
      : isTerminalBusy || (isActionClicked && !outputData)
        ? "var(--vscode-editorWarning-foreground, #e3b341)"
        : isActiveGroup
          ? "var(--vscode-button-background)"
          : "var(--vscode-descriptionForeground)";

  return (
    <div
      className="timeline-item"
      style={{ marginTop: "4px", paddingLeft: "29px" }}
    >
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 0 6px 0",
        }}
      >
        <div
          onClick={() => {
            if (isCompleted || hasOutput) setIsCollapsed((v) => !v);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
            flex: 1,
            cursor: isCompleted || hasOutput ? "pointer" : "default",
          }}
        >
          {(isCompleted || hasOutput) && (
            <span
              className={`codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}
              style={{ fontSize: "12px", opacity: 0.8, flexShrink: 0 }}
            />
          )}
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--vscode-editor-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              flexShrink: 0,
            }}
          >
            {t("tools.execute")}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
          }}
        >
          {isTerminalBusy && (
            <button
              className="stop-terminal-btn"
              onClick={(e) => {
                e.stopPropagation();
                extensionService.postMessage({
                  command: "stopCommand",
                  actionId,
                  terminalId,
                });
                if (terminalId)
                  extensionService.postMessage({
                    command: "stopTerminal",
                    terminalId,
                  });
              }}
              title="Finalize output, kill process and delete terminal"
              style={{
                background:
                  "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 10%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--vscode-errorForeground, #f44336) 30%, transparent)",
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
                textTransform: "uppercase",
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
              {t("tools.finalize")}
            </button>
          )}
        </div>
      </div>

      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          style={{
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "12px",
            color: "var(--vscode-terminal-foreground, #cccccc)",
            padding: "6px 10px",
            backgroundColor: "var(--vscode-terminal-background, #1e1e1e)",
            border:
              "1px solid var(--vscode-panel-border, rgba(128,128,128,0.2))",
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
          status={undefined}
          rejectedOutline
        />
      ) : (
        <>
          <TerminalBlock
            logs={outputData?.output || extractedOutput || storedOutput || ""}
            initialCommand={action.params.command}
            cwd={action.params.cwd || rootPath}
            status={isTerminalBusy ? "busy" : hasOutput ? "free" : undefined}
            onInput={
              isTerminalBusy
                ? (data) => {
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
          {needsPrompt &&
            !isTerminalBusy &&
            !isCompleted &&
            (isActiveGroup || isLoading) && (
              <ExecuteButton
                isActive={isActiveGroup || false}
                isCompleted={isCompleted}
                isLastMessage={isLastMessage}
                isSkipped={!isActiveGroup && !isLastMessage && !isActionClicked}
                isLoading={isLoading}
                toolColor={toolColor}
                title={
                  isCompleted
                    ? "Completed"
                    : isLoading
                      ? "Executing..."
                      : "Execute action"
                }
                onExecute={(e, type) => {
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
    </div>
  );
};

export default TerminalToolItem;
