import React from "react";
import { ToolAction } from "../../../../../services/ResponseParser";
import FileIcon from "../../../../common/FileIcon";
import { CodeBlock } from "../../../../CodeBlock";
import { ToolHeader } from "../../../../ToolHeader";
import { getFilename, getToolColor, handleDiffClick } from "../../utils";
import { CLICKABLE_TOOLS } from "../../constants";
import ExecuteButton from "./ExecuteButton";
import { truncatePath } from "./FileToolItem";

interface GroupedToolItemProps {
  group: { action: ToolAction; index: number }[];
  messageId: string;
  clickedActions: Set<string>;
  failedActions?: Set<string>;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  fileStatsMap: Record<string, { lines: number; loading: boolean }>;
  isPreviewing: string | null;
  fuzzyStatus: { status: string; score?: number; startLine?: number } | null;
  rootPath?: string;
  onToolClick: (
    action: ToolAction | any,
    messageId: string,
    index: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  onSetIsPreviewing: (id: string | null) => void;
  collapsedActions: Set<string>;
  onToggleCollapse: (id: string) => void;
}

const GroupedToolItem: React.FC<GroupedToolItemProps> = ({
  group,
  messageId,
  clickedActions,
  failedActions,
  isActiveGroup,
  isLastMessage,
  executionState,
  toolOutputs,
  terminalStatus,
  fileStatsMap,
  isPreviewing,
  fuzzyStatus,
  rootPath,
  onToolClick,
  onSetIsPreviewing,
  collapsedActions,
  onToggleCollapse,
}) => {
  const firstAction = group[0].action;
  const toolColor = getToolColor(firstAction.type);
  const clickableTools = CLICKABLE_TOOLS;

  const allCompleted = group.every((item) =>
    clickedActions.has(`${messageId}-action-${item.index}`),
  );

  return (
    <div style={{ marginBottom: "0px" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--vscode-editor-background)",
          border: `1px solid ${toolColor}40`,
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <ToolHeader
          title="Steps"
          subTitle={`${group.length} action${group.length > 1 ? "s" : ""}`}
          statusColor={
            allCompleted
              ? "#3fb950"
              : isActiveGroup
                ? "var(--vscode-button-background)"
                : "var(--vscode-descriptionForeground)"
          }
          isCollapsed={false}
          icon={
            <div
              className="codicon codicon-layers"
              style={{ fontSize: "14px", marginRight: "4px" }}
            />
          }
          headerActions={
            (isActiveGroup || allCompleted || !isLastMessage) && (
              <ExecuteButton
                isActive={isActiveGroup || false}
                isCompleted={allCompleted}
                isLastMessage={isLastMessage}
                isSkipped={!isActiveGroup && !isLastMessage && !allCompleted}
                toolColor={toolColor}
                title={allCompleted ? "Completed" : "Execute all actions"}
                onExecute={(e, type) => {
                  if (allCompleted) return;
                  const unclicked = group.filter(
                    ({ index }) =>
                      !clickedActions.has(`${messageId}-action-${index}`),
                  );
                  if (unclicked.length > 0) {
                    onToolClick(
                      unclicked.map(({ action, index }) => ({
                        ...action,
                        _index: index,
                      })),
                      messageId,
                      -1,
                      type,
                    );
                  }
                }}
              />
            )
          }
        />

        {group.map((item, idx) => {
          const { action, index } = item;
          const actionId = `${messageId}-action-${index}`;
          const isLast = idx === group.length - 1;
          const isActionClicked = clickedActions.has(actionId);
          const isCollapsed = collapsedActions.has(actionId);

          // Diff stats for replace_in_file
          let diffStats = null;
          if (action.type === "replace_in_file" && action.params.diff) {
            const diffText = action.params.diff;
            let added = 0,
              removed = 0;
            const searchPattern =
              /<<<<<<< SEARCH\s+([\s\S]*?)=======\s+([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/g;
            const matches = [...diffText.matchAll(searchPattern)];
            if (matches.length > 0) {
              matches.forEach((match) => {
                const getLines = (t: string) =>
                  t.replace(/\r\n/g, "\n").trimEnd().split("\n");
                const sl = getLines(match[1] || ""),
                  rl = getLines(match[2] || "");
                if (sl.length === 1 && sl[0] === "") {
                  added += rl[0] !== "" ? rl.length : 0;
                  return;
                }
                if (rl.length === 1 && rl[0] === "") {
                  removed += sl[0] !== "" ? sl.length : 0;
                  return;
                }
                let pre = 0;
                const min = Math.min(sl.length, rl.length);
                while (pre < min && sl[pre] === rl[pre]) pre++;
                let suf = 0;
                const minR = Math.min(sl.length - pre, rl.length - pre);
                while (
                  suf < minR &&
                  sl[sl.length - 1 - suf] === rl[rl.length - 1 - suf]
                )
                  suf++;
                removed += sl.length - pre - suf;
                added += rl.length - pre - suf;
              });
            } else {
              diffText.split("\n").forEach((line: string) => {
                if (line.startsWith("+") && !line.startsWith("+++")) added++;
                if (line.startsWith("-") && !line.startsWith("---")) removed++;
              });
            }
            diffStats = { added, removed };
          }

          if (action.type === "run_command") {
            const outputData = toolOutputs?.[actionId];
            const terminalId =
              (outputData as any)?.terminalId || action.params.terminal_id;
            const isTerminalBusy = terminalId
              ? terminalStatus?.[terminalId] === "busy"
              : false;
            const hasOutput = !!outputData;
            const isLoading = isActionClicked && (!hasOutput || isTerminalBusy);
            const isCompleted = hasOutput && !isTerminalBusy;

            return (
              <div
                key={index}
                style={{
                  padding: "0",
                  borderBottom: isLast ? "none" : `1px solid ${toolColor}20`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <ToolHeader
                  title="RUN"
                  subTitle={truncatePath(action.params.cwd || rootPath)}
                  statusColor={
                    isCompleted
                      ? "#3fb950"
                      : isActiveGroup
                        ? "var(--vscode-button-background)"
                        : "var(--vscode-descriptionForeground)"
                  }
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => onToggleCollapse(actionId)}
                  icon={
                    <div
                      className="codicon codicon-terminal"
                      style={{ fontSize: "14px", marginRight: "4px" }}
                    />
                  }
                  headerActions={
                    ((isActiveGroup &&
                      (executionState?.completed === index ||
                        isCompleted ||
                        isLoading)) ||
                      !isLastMessage) && (
                      <ExecuteButton
                        isActive={isActiveGroup || false}
                        isCompleted={isCompleted}
                        isLastMessage={isLastMessage}
                        isSkipped={
                          !isActiveGroup && !isLastMessage && !isActionClicked
                        }
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
                          if (!isCompleted && !isLoading)
                            onToolClick(action, messageId, index, type);
                        }}
                      />
                    )
                  }
                />
                {!isCollapsed && (
                  <div style={{ paddingLeft: "10px" }}>
                    <CodeBlock
                      code={action.params.command}
                      language="shell"
                      filename="command"
                      maxLines={5}
                      isCollapsed={false}
                    />
                    {outputData && (
                      <CodeBlock
                        code={outputData.output}
                        language="text"
                        filename="output"
                        maxLines={10}
                        isCollapsed={false}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={index}
              style={{
                padding: "6px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                borderBottom: isLast ? "none" : `1px solid ${toolColor}10`,
                minHeight: "36px",
              }}
            >
              <FileIcon
                path={getFilename(action)}
                isFolder={action.type === "list_files"}
                isOpen={true}
                style={{ width: "16px", height: "16px" }}
              />
              <span
                style={{
                  fontSize: "13px",
                  fontFamily: "monospace",
                  color: "var(--vscode-editor-foreground)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={action.params.path || action.params.command}
              >
                {getFilename(action)}
              </span>

              {action.type === "read_file" &&
                fileStatsMap[action.params.path]?.lines > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      color:
                        fileStatsMap[action.params.path].lines > 1000
                          ? "#4EC9B0"
                          : "var(--vscode-descriptionForeground)",
                      fontWeight:
                        fileStatsMap[action.params.path].lines > 1000
                          ? 600
                          : 400,
                      marginLeft: "4px",
                      opacity:
                        fileStatsMap[action.params.path].lines > 1000 ? 1 : 0.7,
                    }}
                  >
                    {fileStatsMap[action.params.path].lines} lines
                  </span>
                )}

              {action.type === "write_to_file" && (
                <>
                  <span
                    style={{
                      fontSize: "11px",
                      color:
                        (action.params.content?.split("\n").length || 0) > 1000
                          ? "#4EC9B0"
                          : "var(--vscode-descriptionForeground)",
                      fontWeight:
                        (action.params.content?.split("\n").length || 0) > 1000
                          ? 600
                          : 400,
                      marginLeft: "4px",
                      opacity:
                        (action.params.content?.split("\n").length || 0) > 1000
                          ? 1
                          : 0.7,
                    }}
                  >
                    {action.params.content?.split("\n").length || 0} lines
                  </span>
                  <button
                    onClick={() =>
                      onSetIsPreviewing(
                        isPreviewing === actionId ? null : actionId,
                      )
                    }
                    title="Preview Modification"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--vscode-icon-foreground)",
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0.7")
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  {isPreviewing === actionId && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        right: 0,
                        zIndex: 10,
                        width: "300px",
                        maxHeight: "300px",
                        overflow: "auto",
                        backgroundColor: "var(--vscode-editor-background)",
                        border: "1px solid var(--vscode-widget-border)",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        borderRadius: "4px",
                        padding: "8px",
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        fontSize: "11px",
                      }}
                    >
                      {action.params.content}
                    </div>
                  )}
                </>
              )}

              {action.type === "read_file" && (
                <button
                  onClick={() =>
                    (window as any).vscodeApi?.postMessage({
                      command: "openFile",
                      path: action.params.path,
                    })
                  }
                  title="Open File"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                    color: "var(--vscode-icon-foreground)",
                    opacity: 0.7,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}

              {action.type === "replace_in_file" && (
                <>
                  {diffStats && (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    >
                      <span
                        style={{
                          color:
                            "var(--vscode-gitDecoration-addedResourceForeground)",
                        }}
                      >
                        +{diffStats.added}
                      </span>
                      <span
                        style={{
                          color:
                            "var(--vscode-gitDecoration-deletedResourceForeground)",
                        }}
                      >
                        -{diffStats.removed}
                      </span>
                    </div>
                  )}
                  {fuzzyStatus && (
                    <div
                      style={{
                        fontSize: "11px",
                        marginLeft: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        color:
                          fuzzyStatus.status === "exact"
                            ? "var(--vscode-testing-iconPassed)"
                            : fuzzyStatus.status === "fuzzy"
                              ? "var(--vscode-list-warningForeground)"
                              : "var(--vscode-errorForeground)",
                      }}
                    >
                      {fuzzyStatus.status === "exact" && <span>✓ Exact</span>}
                      {fuzzyStatus.status === "fuzzy" && (
                        <span>
                          ⚠ Fuzzy (
                          {Math.round((1 - (fuzzyStatus.score || 0)) * 100)}%)
                        </span>
                      )}
                      {fuzzyStatus.status === "none" && <span>✗ No Match</span>}
                    </div>
                  )}
                  <button
                    onClick={(e) => handleDiffClick(e, action)}
                    title="Preview Diff"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--vscode-icon-foreground)",
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0.7")
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                      <path d="M9 10h6" />
                      <path d="M12 13V7" />
                      <path d="M9 17h6" />
                    </svg>
                  </button>
                </>
              )}

              {clickedActions.has(actionId) &&
                !failedActions?.has(actionId) && (
                  <div
                    style={{
                      marginLeft: "auto",
                      color: "var(--vscode-testing-iconPassed)",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              {!clickedActions.has(actionId) &&
                failedActions?.has(actionId) && (
                  <div
                    style={{
                      marginLeft: "auto",
                      color: "var(--vscode-errorForeground)",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                )}

              {executionState?.status === "running" &&
                executionState.completed === index && (
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--vscode-descriptionForeground)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span className="codicon codicon-loading codicon-modifier-spin" />
                      Running...
                    </span>
                    <button
                      onClick={() =>
                        (window as any).vscodeApi?.postMessage({
                          command: "stopCommand",
                          actionId: `${messageId}-action-${index}`,
                          kill: false,
                        })
                      }
                      title="Detach"
                      style={{
                        background: "var(--vscode-button-secondaryBackground)",
                        color: "var(--vscode-button-secondaryForeground)",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: "10px",
                      }}
                    >
                      Detach
                    </button>
                    <button
                      onClick={() =>
                        (window as any).vscodeApi?.postMessage({
                          command: "stopCommand",
                          actionId: `${messageId}-action-${index}`,
                          kill: true,
                        })
                      }
                      title="Stop execution"
                      style={{
                        background:
                          "var(--vscode-button-dangerBackground, #d73a49)",
                        color: "var(--vscode-button-foreground)",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: "10px",
                      }}
                    >
                      Stop
                    </button>
                  </div>
                )}
              {executionState?.status === "running" &&
                executionState.completed < index && (
                  <div
                    style={{
                      marginLeft: "auto",
                      color: "var(--vscode-descriptionForeground)",
                      fontSize: "11px",
                      opacity: 0.7,
                    }}
                  >
                    Waiting...
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GroupedToolItem;
