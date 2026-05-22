import React from "react";
import { ToolAction } from "../../../../../services/ResponseParser";
import { TerminalBlock } from "../../../../TerminalBlock";
import { getToolColor } from "../../utils";
import { extensionService } from "../../../../../services/ExtensionService";
import { Message } from "../../types";
import ExecuteButton from "./ExecuteButton";
import { truncatePath } from "./FileToolItem";
import { useI18n } from "../../../../../hooks/useI18n";

interface TerminalToolItemProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked: boolean;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean; terminalId?: string }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  rootPath?: string;
  onToolClick: (action: ToolAction, messageId: string, index: number, type: "accept_all" | "accept_once" | "reject") => void;
}

const TerminalToolItem: React.FC<TerminalToolItemProps> = ({
  action, actionIndex, messageId, isActionClicked, isActiveGroup,
  isLastMessage, toolOutputs, terminalStatus, nextUserMessage, rootPath, onToolClick,
}) => {
  const toolColor = getToolColor("run_command");
  const { t } = useI18n();
  const actionId = `${messageId}-action-${actionIndex}`;
  const outputData = toolOutputs?.[actionId];

  let extractedOutput: string | undefined;
  if (!outputData?.output && nextUserMessage?.content) {
    const commandText = action.params.command;
    if (commandText) {
      const escaped = commandText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(
        `Output: \\[run_command for '${escaped}'.*?\\][^\\n]*\\n\\s*\`\`\`\\n([\\s\\S]*?)\\n\\s*\`\`\``
      ).exec(nextUserMessage.content);
      if (match?.[1]) extractedOutput = match[1];
    }
  }

  const terminalId = (outputData as any)?.terminalId || action.params.terminal_id;
  const hasOutput = !!outputData || !!extractedOutput;
  const isTerminalBusy = terminalId
    ? terminalStatus?.[terminalId] === "busy" || (isActionClicked && terminalStatus?.[terminalId] === undefined)
    : isActionClicked;
  const isLoading = isActionClicked && (!hasOutput || isTerminalBusy);
  const isCompleted = hasOutput && !isTerminalBusy;
  const dotColor = isCompleted ? "#3fb950"
    : isTerminalBusy || (isActionClicked && !outputData) ? "#e3b341"
    : isActiveGroup ? "var(--vscode-button-background)"
    : "var(--vscode-descriptionForeground)";

  return (
    <div className="timeline-item" style={{ marginTop: "4px", paddingLeft: "29px" }}>
      <div
        className="timeline-dot"
        style={{
          backgroundColor: dotColor,
          boxShadow: `0 0 0 2px var(--vscode-editor-background), 0 0 0 3px ${
            dotColor.startsWith("var") ? dotColor : `${dotColor}80`
          }`,
          top: "10px",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 6px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--vscode-editor-foreground)", textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.8 }}>
              {t("tools.execute")}
            </span>
          {(action.params.cwd || rootPath) && (
            <span style={{
              fontSize: "11px", color: "var(--vscode-descriptionForeground)", opacity: 0.6,
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              backgroundColor: "var(--vscode-editor-background)", padding: "1px 6px",
              borderRadius: "4px", border: "1px solid var(--vscode-widget-border)",
            }}>
              {truncatePath(action.params.cwd || rootPath)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {!isTerminalBusy && (isActiveGroup || isCompleted || isLoading || !isLastMessage) && (
            <ExecuteButton
              isActive={isActiveGroup || false}
              isCompleted={isCompleted}
              isLastMessage={isLastMessage}
              isSkipped={!isActiveGroup && !isLastMessage && !isActionClicked}
              isLoading={isLoading}
              toolColor={toolColor}
              title={isCompleted ? "Completed" : isLoading ? "Executing..." : "Execute action"}
              onExecute={(e, type) => {
                if (!isCompleted && !isLoading) {
                  onToolClick({ ...action, params: { ...action.params, terminal_id: terminalId } }, messageId, actionIndex, type);
                }
              }}
            />
          )}
          {isTerminalBusy && (
            <button
              className="stop-terminal-btn"
              onClick={(e) => {
                e.stopPropagation();
                extensionService.postMessage({ command: "stopCommand", actionId, terminalId });
                if (terminalId) extensionService.postMessage({ command: "stopTerminal", terminalId });
              }}
              title="Finalize output, kill process and delete terminal"
              style={{
                background: "rgba(244, 67, 54, 0.1)", border: "1px solid rgba(244, 67, 54, 0.3)",
                cursor: "pointer", color: "rgb(244, 67, 54)", padding: "4px 8px", borderRadius: "6px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: 600, gap: "6px", height: "24px", textTransform: "uppercase",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              {t("tools.finalize")}
            </button>
          )}
        </div>
      </div>

      <TerminalBlock
        logs={outputData?.output || extractedOutput || ""}
        initialCommand={action.params.command}
        cwd={action.params.cwd || rootPath}
        status={isTerminalBusy ? "busy" : hasOutput ? "free" : undefined}
        onInput={(data) => {
          if (terminalId) extensionService.postMessage({ command: "terminalInput", terminalId, data });
        }}
      />
    </div>
  );
};

export default TerminalToolItem;
