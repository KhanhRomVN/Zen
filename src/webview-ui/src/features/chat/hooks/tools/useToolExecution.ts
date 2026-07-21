import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";
import { Message } from "../../types/message";

import { parseAIResponse } from "../../services/ResponseParser";
import { useSettings } from "../../../../context/SettingsContext";
import { formatGrepResultCompact } from "../../utils/grepFormatter";
export { getPermissionDecision } from "../../utils/permissionUtils";
import { getPermissionDecision } from "../../utils/permissionUtils";
import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { getToolTimeout, TOOL_ACTION_TYPES, EXECUTION_STATUS, TERMINAL_STATUS } from "../../constants/constants";
import type { PermissionMode } from "../../types/tag-types";

interface UseToolExecutionProps {
  sendMessage: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipFirstRequestLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
  ) => Promise<void>;
  conversationIdRef?: React.MutableRefObject<string>;
  messagesRef?: React.MutableRefObject<Message[]>;
  /** When true, all pending auto-flush sends are suppressed (set by stop button) */
  isStoppedRef?: React.MutableRefObject<boolean>;
}

export const useToolExecution = ({
  sendMessage,
  conversationIdRef,
  messagesRef,
  isStoppedRef,
}: UseToolExecutionProps) => {
  const { permissionMode } = useSettings();
  // Use a ref so handleToolRequest (memoised with []) always reads the latest mode,
  // avoiding a stale-closure bug when the user switches modes mid-session.
  const permissionModeRef = useRef<PermissionMode>(permissionMode);
  // Sử dụng useLayoutEffect để update ref ngay lập tức khi permissionMode thay đổi
  // Tránh stale closure khi handleToolRequest được gọi ngay sau khi mode change
  useLayoutEffect(() => {
    permissionModeRef.current = permissionMode;
  }, [permissionMode]);
  const [executionState, setExecutionState] = useState<{
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  }>({ total: 0, completed: 0, status: EXECUTION_STATUS.IDLE });

  const [toolOutputs, setToolOutputs] = useState<
    Record<
      string,
      {
        output: string;
        isError: boolean;
        terminalId?: string;
        diagnostics?: Array<{
          severity: string;
          message: string;
          line: number;
          column: number;
          source?: string;
          code?: string | number;
        }>;
      }
    >
  >({});

  const [terminalStatus, setTerminalStatus] = useState<
    Record<string, typeof TERMINAL_STATUS[keyof typeof TERMINAL_STATUS]>
  >({});

  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  const [rejectedActions, setRejectedActions] = useState<Set<string>>(
    new Set(),
  );

  // Single-line review state for write_to_file actions
  const [singleLineReviewActions, setSingleLineReviewActions] = useState<
    Record<
      string,
      { action: any; actionId: string; messageId: string; messageObj: Message }
    >
  >({});

  const clickedActionsRef = useRef<Set<string>>(new Set());
  const pendingToolResolvers = useRef<
    Map<string, (result: string | null) => void>
  >(new Map());
  const commandStartTimes = useRef<Map<string, number>>(new Map());
  const earlyCommandResults = useRef<Map<string, any>>(new Map()); // cache commandExecuted that arrived before resolver was set
  const handleSendMessageRef = useRef(sendMessage);

  // 🆕 Buffer for tool results (to support multi-step tool calls)
  const [availableToolResultsBuffer, setAvailableToolResultsBuffer] = useState<{
    [messageId: string]: string[];
  }>({});

  const terminalToActionMap = useRef<Map<string, string>>(new Map());
  const flushedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    handleSendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    clickedActionsRef.current = clickedActions;
  }, [clickedActions]);

  // Listen for tool execution events from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "commandExecuted") {
        if (message.actionId) {
          setToolOutputs((prev) => {
            const existing = prev[message.actionId];
            let finalOutput = message.output || "";
            if (
              existing?.output &&
              existing.output.length > finalOutput.length
            ) {
              finalOutput = existing.output;
            }
            return {
              ...prev,
              [message.actionId]: {
                output: finalOutput,
                isError: !!message.error,
                terminalId: message.terminalId,
              },
            };
          });

          if (pendingToolResolvers.current.has(message.actionId)) {
            const resolver = pendingToolResolvers.current.get(
              message.actionId,
            )!;
            if (message.terminalId) {
              terminalToActionMap.current.delete(message.terminalId);
              // cleanup terminal after command finishes
              extensionService.postMessage({
                command: "removeTerminal",
                terminalId: message.terminalId,
              });
            }
            commandStartTimes.current.delete(message.actionId);
            const cmdText =
              message.commandText || message.commandTextRaw || "command";
            const outputContent = (message.output || "").trim();
            const resultMsg = message.error
              ? `Output: [run_command for '${cmdText}'] Error - ${message.error}\n\`\`\`\n${outputContent}\n\`\`\``
              : `Output: [run_command for '${cmdText}']\n\`\`\`\n${outputContent}\n\`\`\``;
            resolver(resultMsg);
            pendingToolResolvers.current.delete(message.actionId);
          } else {
            earlyCommandResults.current.set(message.actionId, message);
          }
        }
      } else if (message.command === "terminalOutput") {
        const actionId = terminalToActionMap.current.get(message.terminalId);
        if (actionId) {
          setToolOutputs((prev) => {
            const existing = prev[actionId] || { output: "", isError: false };
            return {
              ...prev,
              [actionId]: {
                ...existing,
                output: existing.output + message.data,
                terminalId: message.terminalId,
              },
            };
          });
        }
      } else if (message.command === "terminalStatusChanged") {
        setTerminalStatus((prev) => ({
          ...prev,
          [message.terminalId]: message.status as typeof TERMINAL_STATUS[keyof typeof TERMINAL_STATUS],
        }));
      } else if (message.command === "restoreSingleLineReviewActions") {
        if (message.actions && Object.keys(message.actions).length > 0) {
          setSingleLineReviewActions(message.actions);
        }
      } else if (message.command === "runCommandResult") {
        if (message.terminalId && message.actionId) {
          terminalToActionMap.current.set(message.terminalId, message.actionId);
          setToolOutputs((prev) => ({
            ...prev,
            [message.actionId]: {
              ...(prev[message.actionId] || { output: "", isError: false }),
              terminalId: message.terminalId,
            },
          }));
          // Initially set to busy when command is run
          setTerminalStatus((prev) => ({
            ...prev,
            [message.terminalId]: TERMINAL_STATUS.BUSY,
          }));
        }
      } else if (message.command === "gitStatusResult") {
        // Handle git status results
        if (message.actionId && message.output !== undefined) {
          setToolOutputs((prev) => ({
            ...prev,
            [message.actionId]: {
              output: message.output || "",
              isError: !!message.error,
            },
          }));
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const executeSingleAction = (
    action: any,
    skipDiagnostics: boolean = false,
    bypassIgnore: boolean = false,
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      switch (action.type) {
        case "read_file": {
          const requestId = `read-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          const actionId = (action as any).actionId;

          extensionService.postMessage({
            command: "readFile",
            path: filePath,
            start_line: action.params.start_line,
            end_line: action.params.end_line,
            requestId,
            bypassIgnore,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                // Store error in toolOutputs without diagnostics
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: `Error - ${msg.error}`,
                    isError: true,
                  },
                }));
                resolve(
                  `[read_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                const content = msg.content || "";
                let output = `[read_file for '${filePath}'] Result:\n\`\`\`\n${content}\n\`\`\``;

                // Add diagnostics section if there are any warnings or errors
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                  const errorCount = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Error" || d.severity === "error",
                  ).length;
                  const warningCount = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Warning" || d.severity === "warning",
                  ).length;

                  // Add diagnostics OUTSIDE the code block
                  output += `\n\n**Summary:** ${errorCount} error(s), ${warningCount} warning(s)`;

                  // Get file content lines for context
                  const contentLines = content.split("\n");

                  // Group by severity
                  const errors = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "error" || d.severity === "Error",
                  );
                  const warnings = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "warning" || d.severity === "Warning",
                  );

                  if (errors.length > 0) {
                    output += `\n\n### Errors (${errors.length})\n`;
                    errors.forEach((d: any, index: number) => {
                      const lineContent = contentLines[d.line - 1] || "";
                      const trimmedLine = lineContent.trim();
                      output += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
                    });
                  }

                  if (warnings.length > 0) {
                    output += `\n### Warnings (${warnings.length})\n`;
                    warnings.forEach((d: any, index: number) => {
                      const lineContent = contentLines[d.line - 1] || "";
                      const trimmedLine = lineContent.trim();
                      output += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
                    });
                  }
                }

                // Store output AND diagnostics in toolOutputs
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: content,
                    isError: false,
                    diagnostics: msg.diagnostics || undefined,
                  },
                }));

                resolve(output);
              }
            },
            getToolTimeout(action.type),
            () => {
              console.warn(`[read_file] Timeout`, { requestId, filePath });
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. The file operation took too long to complete.`;
              // Store timeout error in toolOutputs
              setToolOutputs((prev) => ({
                ...prev,
                [actionId]: {
                  output: timeoutError,
                  isError: true,
                },
              }));
              resolve(
                `[read_file for '${filePath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }
        case "write_to_file": {
          const requestId = `write-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          const actionId = action.actionId;
          extensionService.postMessage({
            command: "writeFile",
            path: filePath,
            content: action.params.content,
            requestId,
            skipDiagnostics,
            bypassIgnore,
            conversationId: conversationIdRef?.current,
            actionId: actionId,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                console.error(`[write_to_file] Error response`, {
                  requestId,
                  filePath,
                  error: msg.error,
                });
                // Store error in toolOutputs
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: `Error - ${msg.error}`,
                    isError: true,
                  },
                }));
                resolve(
                  `[write_to_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[write_to_file for '${filePath}'] Result: File written successfully`;

                // Add diagnostics if any
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                  const errorCount = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Error" || d.severity === "error",
                  ).length;
                  const warningCount = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Warning" || d.severity === "warning",
                  ).length;

                  // Change format: move summary inline with success message
                  result = `[write_to_file for '${filePath}'] Result: File written successfully with ${errorCount} error(s), ${warningCount} warning(s)`;

                  const errors = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Error" || d.severity === "error",
                  );
                  const warnings = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Warning" || d.severity === "warning",
                  );

                  // Get file content lines to show line content
                  const contentLines = action.params.content.split("\n");

                  if (errors.length > 0) {
                    result += `\n\n### Errors (${errors.length})\n`;
                    errors.forEach((d: any, index: number) => {
                      const lineContent = contentLines[d.line - 1] || "";
                      const trimmedLine = lineContent.trim();
                      result += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
                    });
                  }

                  if (warnings.length > 0) {
                    result += `\n### Warnings (${warnings.length})\n`;
                    warnings.forEach((d: any, index: number) => {
                      const lineContent = contentLines[d.line - 1] || "";
                      const trimmedLine = lineContent.trim();
                      result += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
                    });
                  }
                }

                // Store output AND diagnostics in toolOutputs (same as read_file)
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: action.params.content,
                    isError: false,
                    diagnostics: msg.diagnostics || undefined,
                  },
                }));

                resolve(result);
              }
            },
            getToolTimeout(action.type),
            () => {
              console.warn(`[write_to_file] Timeout`, { requestId, filePath });
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. The file write took too long to complete (possibly waiting for diagnostics).`;
              // Store timeout error in toolOutputs
              setToolOutputs((prev) => ({
                ...prev,
                [actionId]: {
                  output: timeoutError,
                  isError: true,
                },
              }));
              resolve(
                `[write_to_file for '${filePath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }
        case "replace_in_file": {
          const requestId = `replace-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          const actionId = action.actionId;
          extensionService.postMessage({
            command: "replaceInFile",
            path: filePath,
            old_str: action.params.old_content,
            new_str: action.params.new_content,
            requestId,
            skipDiagnostics,
            bypassIgnore,
            conversationId: conversationIdRef?.current,
            actionId: actionId,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                console.error(`[replace_in_file] Error response`, {
                  requestId,
                  filePath,
                  error: msg.error,
                });
                // Store error in toolOutputs
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: `Error - ${msg.error}`,
                    isError: true,
                  },
                }));
                resolve(
                  `[replace_in_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[replace_in_file for '${filePath}'] Result: File updated successfully`;

                // Add diagnostics if any
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                  const errorCount = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Error" || d.severity === "error",
                  ).length;
                  const warningCount = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Warning" || d.severity === "warning",
                  ).length;

                  // Change format: move summary inline with success message
                  result = `[replace_in_file for '${filePath}'] Result: File updated successfully with ${errorCount} error(s), ${warningCount} warning(s)`;

                  const errors = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Error" || d.severity === "error",
                  );
                  const warnings = msg.diagnostics.filter(
                    (d: any) =>
                      d.severity === "Warning" || d.severity === "warning",
                  );

                  // Get file content lines to show line content (use msg.content if available, otherwise use new_content)
                  const contentLines = (
                    msg.content ||
                    action.params.new_content ||
                    ""
                  ).split("\n");

                  if (errors.length > 0) {
                    result += `\n\n### Errors (${errors.length})\n`;
                    errors.forEach((d: any, index: number) => {
                      const lineContent = contentLines[d.line - 1] || "";
                      const trimmedLine = lineContent.trim();
                      result += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
                    });
                  }

                  if (warnings.length > 0) {
                    result += `\n### Warnings (${warnings.length})\n`;
                    warnings.forEach((d: any, index: number) => {
                      const lineContent = contentLines[d.line - 1] || "";
                      const trimmedLine = lineContent.trim();
                      result += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
                    });
                  }
                }

                // Store output AND diagnostics in toolOutputs (same as read_file)
                setToolOutputs((prev) => {
                  const newOutput = {
                    output: msg.content || action.params.new_content || "",
                    isError: false,
                    diagnostics: msg.diagnostics || undefined,
                  };

                  return {
                    ...prev,
                    [actionId]: newOutput,
                  };
                });

                resolve(result);
              }
            },
            getToolTimeout(action.type),
            () => {
              console.warn(`[replace_in_file] Timeout`, {
                requestId,
                filePath,
              });
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. The file replacement took too long to complete (possibly waiting for diagnostics).`;
              // Store timeout error in toolOutputs
              setToolOutputs((prev) => ({
                ...prev,
                [actionId]: {
                  output: timeoutError,
                  isError: true,
                },
              }));
              resolve(
                `[replace_in_file for '${filePath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }
        case "revert_file": {
          const requestId = `revert-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          const version = action.params.version; // Lấy version từ params
          const actionId = action.actionId;

          extensionService.postMessage({
            command: "revertFile",
            path: filePath,
            version, // Truyền version parameter
            requestId,
            bypassIgnore,
            conversationId: conversationIdRef?.current,
            actionId: actionId,
          });

          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                console.error(`[revert_file] Error response`, {
                  requestId,
                  filePath,
                  error: msg.error,
                });
                // Store error in toolOutputs
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: `Error - ${msg.error}`,
                    isError: true,
                  },
                }));
                resolve(
                  `[revert_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                const versionMsg =
                  version !== undefined ? ` to version ${version}` : "";
                const result = `[revert_file for '${filePath}'] Result: File reverted successfully${versionMsg}`;

                // Store old/new content in action params for diff view
                if (
                  msg.oldContent !== undefined &&
                  msg.newContent !== undefined
                ) {
                  action.params.old_content = msg.oldContent;
                  action.params.new_content = msg.newContent;
                }

                // Store output in toolOutputs
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: "Reverted",
                    isError: false,
                    diagnostics: msg.diagnostics || undefined,
                  },
                }));

                resolve(result);
              }
            },
            getToolTimeout(action.type),
            () => {
              console.warn(`[revert_file] Timeout`, { requestId, filePath });
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. The file revert took too long to complete.`;
              setToolOutputs((prev) => ({
                ...prev,
                [actionId]: {
                  output: timeoutError,
                  isError: true,
                },
              }));
              resolve(
                `[revert_file for '${filePath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }
        case "view_replace_history": {
          const requestId = `view-history-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          const actionId = action.actionId;

          extensionService.postMessage({
            command: "viewReplaceHistory",
            filePath,
            conversationId: conversationIdRef?.current,
            requestId,
          });

          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                console.error(`[view_replace_history] Error response`, {
                  requestId,
                  filePath,
                  error: msg.error,
                });
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: `Error - ${msg.error}`,
                    isError: true,
                  },
                }));
                resolve(
                  `[view_replace_history for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                const histories = msg.histories || [];

                if (histories.length === 0) {
                  const result = `[view_replace_history for '${filePath}'] Result: No replace_in_file history found for this file.`;
                  setToolOutputs((prev) => ({
                    ...prev,
                    [actionId]: {
                      output: "No history",
                      isError: false,
                    },
                  }));
                  resolve(result);
                  return;
                }

                let result = `[view_replace_history for '${filePath}'] Found ${histories.length} version(s):\n\n`;

                histories.forEach(
                  (
                    h: {
                      version: number;
                      errorCount: number;
                      warningCount: number;
                      lineCount: number;
                    },
                    index: number,
                  ) => {
                    result += `**Version ${h.version}**\n`;
                    result += `- Lines: ${h.lineCount}, Errors: ${h.errorCount}, Warnings: ${h.warningCount}\n`;
                    if (index < histories.length - 1) {
                      result += `\n`;
                    }
                  },
                );

                const stringified = JSON.stringify(histories);
                setToolOutputs((prev) => {
                  const newOutputs = {
                    ...prev,
                    [actionId]: {
                      output: stringified,
                      isError: false,
                    },
                  };
                  return newOutputs;
                });

                resolve(result);
              }
            },
            getToolTimeout(action.type),
            () => {
              console.warn(`[view_replace_history] Timeout`, {
                requestId,
                filePath,
              });
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. Failed to retrieve file history.`;
              setToolOutputs((prev) => ({
                ...prev,
                [actionId]: {
                  output: timeoutError,
                  isError: true,
                },
              }));
              resolve(
                `[view_replace_history for '${filePath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }
        case "list_files": {
          const requestId = `list-${Date.now()}-${Math.random()}`;
          const folderPath = action.params.path || action.params.folder_path;
          const actionId = (action as any).actionId;

          extensionService.postMessage({
            command: "listFiles",
            path: folderPath,
            recursive: action.params.recursive,
            depth: action.params.depth,
            type: action.params.type,
            requestId,
            bypassIgnore,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                resolve(
                  `[list_files for '${folderPath}'] Result: Error - ${msg.error}`,
                );
                return;
              }
              const listResults = msg.files || msg.results;

              // Check if folder is empty
              if (
                !listResults ||
                (typeof listResults === "string" &&
                  listResults.trim() === "") ||
                (Array.isArray(listResults) && listResults.length === 0)
              ) {
                resolve(
                  `[list_files for '${folderPath}'] Result: The folder '${folderPath}' is empty (no files or folders inside).`,
                );
                return;
              }

              // Store the raw JSON tree data in toolOutputs for TreeBlock to consume
              if (Array.isArray(listResults) && actionId) {
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: listResults, // Store raw JSON array for UI
                    isError: false,
                  },
                }));

                // Format as readable tree for agent (no emojis, no tree lines)
                const formatTree = (
                  nodes: any[],
                  indent: string = "",
                ): string => {
                  let result = "";
                  nodes.forEach((node) => {
                    // Node line (no tree characters, just indentation)
                    if (node.type === "folder") {
                      result += `${indent}${node.name}/`;
                      if (node.children && node.children.length > 0) {
                        result += ` (${node.children.length} files)`;
                      }
                      result += "\n";
                      if (node.children && node.children.length > 0) {
                        result += formatTree(node.children, indent + "  ");
                      }
                    } else {
                      result += `${indent}${node.name}`;
                      if (node.lines !== undefined) {
                        result += ` (${node.lines} lines)`;
                      }
                      result += "\n";
                    }
                  });
                  return result;
                };

                const formattedOutput = formatTree(listResults);
                resolve(
                  `[list_files for '${folderPath}'] Result:\n${formattedOutput}`,
                );
              } else {
                // Fallback
                const outputStr =
                  typeof listResults === "string"
                    ? listResults
                    : String(listResults);
                resolve(
                  `[list_files for '${folderPath}'] Result:\n${outputStr}`,
                );
              }
            },
            getToolTimeout(action.type),
            () => {
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. Failed to list files.`;
              resolve(
                `[list_files for '${folderPath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }
        case "find_files": {
          const requestId = `find-${Date.now()}-${Math.random()}`;
          const fileNames = action.params.file_names || [];
          extensionService.postMessage({
            command: "findFiles",
            fileNames,
            requestId,
          });

          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                resolve(`[find_files] Result: Error - ${msg.error}`);
                return;
              }

              const results = msg.results || [];
              const totalMatches = msg.totalMatches || 0;

              let output = `[find_files] Found ${totalMatches} file(s)\n\n`;

              if (totalMatches === 0) {
                output += "No files found matching the search criteria.";
              } else {
                results.forEach((result: any) => {
                  if (result.matches.length > 0) {
                    output += `### ${result.fileName} (${result.matches.length} match${result.matches.length === 1 ? "" : "es"})\n`;
                    result.matches.forEach((match: any) => {
                      const matchPath =
                        typeof match === "string" ? match : match.path;
                      let diagnosticInfo = "";

                      if (
                        typeof match === "object" &&
                        (match.errorCount || match.warningCount)
                      ) {
                        const errorCount = match.errorCount || 0;
                        const warningCount = match.warningCount || 0;

                        if (errorCount > 0 || warningCount > 0) {
                          const parts: string[] = [];
                          if (errorCount > 0) {
                            parts.push(
                              `${errorCount} error${errorCount > 1 ? "s" : ""}`,
                            );
                          }
                          if (warningCount > 0) {
                            parts.push(
                              `${warningCount} warning${warningCount > 1 ? "s" : ""}`,
                            );
                          }
                          diagnosticInfo = ` (${parts.join(", ")})`;
                        }
                      }

                      output += `- ${matchPath}${diagnosticInfo}\n`;
                    });
                    output += "\n";
                  }
                });
              }

              resolve(output);
            },
            getToolTimeout(action.type),
            () => {
              console.warn(`[find_files] Timeout`, { requestId, fileNames });
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. Failed to find files.`;
              resolve(`[find_files] Result: Error - ${timeoutError}`);
            },
          );
          break;
        }
        case "run_command": {
          const actionId = (action as any).actionId;
          commandStartTimes.current.set(actionId, Date.now());
          extensionService.postMessage({
            command: "runCommand",
            commandText: action.params.command,
            actionId: actionId,
          });

          // Check if commandExecuted already arrived (race condition)
          if (earlyCommandResults.current.has(actionId)) {
            const msg = earlyCommandResults.current.get(actionId)!;
            earlyCommandResults.current.delete(actionId);
            const cmdText =
              msg.commandText || action.params.command || "command";
            const outputContent = (msg.output || "").trim();
            resolve(
              msg.error
                ? `Output: [run_command for '${cmdText}'] Error - ${msg.error}\n\`\`\`\n${outputContent}\n\`\`\``
                : `Output: [run_command for '${cmdText}']\n\`\`\`\n${outputContent}\n\`\`\``,
            );
            break;
          }

          // Only resolve when process finishes naturally or user clicks "Kết thúc"
          pendingToolResolvers.current.set(actionId, resolve);

          break;
        }

        case "delete_file": {
          const requestId = `delete-file-${Date.now()}-${Math.random()}`;
          const filePath = action.params.file_path;
          extensionService.postMessage({
            command: "deleteFile",
            file_path: filePath,
            requestId,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                resolve(
                  `[delete_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
                return;
              }
              resolve(
                `[delete_file for '${filePath}'] Result: File deleted successfully`,
              );
            },
            getToolTimeout(action.type),
            () => {
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. Failed to delete file.`;
              resolve(
                `[delete_file for '${filePath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }

        case "move_file": {
          const requestId = `move-file-${Date.now()}-${Math.random()}`;
          const filePath = action.params.file_path;
          const targetFolderPath = action.params.target_folder_path;
          extensionService.postMessage({
            command: "moveFile",
            file_path: filePath,
            target_folder_path: targetFolderPath,
            requestId,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                resolve(
                  `[move_file from '${filePath}' to '${targetFolderPath}'] Result: Error - ${msg.error}`,
                );
                return;
              }
              resolve(
                `[move_file from '${filePath}' to '${targetFolderPath}'] Result: File moved successfully to '${msg.newPath || targetFolderPath}'`,
              );
            },
            getToolTimeout(action.type),
            () => {
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. Failed to move file.`;
              resolve(
                `[move_file from '${filePath}' to '${targetFolderPath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }

        case "grep": {
          const searchTerm = action.params.search_term;
          const filePath = action.params.file_path;
          const folderPath = action.params.folder_path;
          const targetDesc = filePath || folderPath || "unknown";

          // Check for validation error from parser
          if (action.params._validationError) {
            const errMsg = action.params._validationError;
            console.warn(
              `[Zen][grep] Validation error | pattern="${searchTerm}" | error="${errMsg}"`,
            );
            resolve(
              `[grep for '${searchTerm}' in '${targetDesc}'] Result: Error - ${errMsg}`,
            );
            break;
          }

          const requestId = `grep-${Date.now()}-${Math.random()}`;

          extensionService.postMessage({
            command: "executeAgentAction",
            action: {
              type: "grep",
              search_term: searchTerm,
              file_path: filePath,
              folder_path: folderPath,
              requestId,
              timestamp: Date.now(),
            },
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.result?.success) {
                const data = msg.result.data;
                // Format as compact XML-like text to minimize token usage
                const resultText = formatGrepResultCompact(data);
                resolve(
                  `[grep for '${searchTerm}' in '${targetDesc}'] Result:\n${resultText}`,
                );
              } else {
                const errMsg = msg.result?.error || "Unknown error";
                console.warn(
                  `[Zen][grep] Error | requestId=${requestId} | error="${errMsg}"`,
                );
                resolve(
                  `[grep for '${searchTerm}' in '${targetDesc}'] Result: Error - ${errMsg}`,
                );
              }
            },
            getToolTimeout(action.type),
            () => {
              console.warn(
                `[Zen][grep] Timeout | requestId=${requestId} | search_term="${searchTerm}" | target="${targetDesc}"`,
              );
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. Search took too long to complete.`;
              resolve(
                `[grep for '${searchTerm}' in '${targetDesc}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }

        case "git_status":
          // git_status is display-only, no execution needed
          // Return special marker to skip auto-flush
          resolve("__DISPLAY_ONLY__");
          break;

        case "git_diff": {
          const requestId = `git-diff-${Date.now()}-${Math.random()}`;
          const filePath = action.params.file_path || action.params.path;
          extensionService.postMessage({
            command: "gitDiff",
            file_path: filePath,
            requestId,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                resolve(
                  `[git_diff for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                let diffContent = msg.diff || "";
                // Clean diff content: remove metadata lines that are not useful for AI
                const cleanLines = diffContent
                  .split("\n")
                  .filter((line: string) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("diff")) return false;
                    if (trimmed.startsWith("index ")) return false;
                    if (trimmed.startsWith("new file mode")) return false;
                    if (trimmed.startsWith("deleted file mode")) return false;
                    if (trimmed.includes("No newline at end of file"))
                      return false;
                    return true;
                  });
                diffContent = cleanLines.join("\n");
                resolve(
                  `[git_diff for '${filePath}'] Result:\n\`\`\`diff\n${diffContent}\n\`\`\``,
                );
              }
            },
            getToolTimeout(action.type),
            () => {
              const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s. Failed to get git diff.`;
              resolve(
                `[git_diff for '${filePath}'] Result: Error - ${timeoutError}`,
              );
            },
          );
          break;
        }

        case "commit_message": {
          break;
        }

        default:
          console.warn(
            `[Zen][tool] Unhandled tool type: "${action.type}" — resolving null`,
          );
          resolve(null);
      }
    });
  };

  const handleToolRequest = useCallback(
    async (
      actionOrActions: any,
      message: Message,
      isAutoTrigger: boolean = false,
      conversationToolOverrides: Record<string, "auto"> = {},
      actionType?: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
    ) => {
      const currentPermissionMode = permissionModeRef.current;
      let wasInterruptedByManual = false;

      const actions = (
        Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
      ).map((a, idx) => ({
        ...a,
        _index: a._index !== undefined ? a._index : idx,
      }));

      // Track actions that were pre-skipped (already triggered) vs actually executed
      const validResults: string[] = [];
      let skippedCount = 0;
      setExecutionState({
        total: actions.length,
        completed: 0,
        status: EXECUTION_STATUS.RUNNING,
      });

      for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        const actionId =
          action.actionId || `${message.id}-action-${action._index}`;

        // DEBUG: Log chi tiết cho tất cả các action

        // GUARD: Prevent duplicate execution of same action Id
        // 🐛 FIX: Khi reject, KHÔNG skip action dù đã có trong clickedActionsRef
        const isReject = actionType === TOOL_ACTION_TYPES.REJECT;
        const isAlreadyClicked = clickedActionsRef.current.has(actionId);
        if (!isReject && isAlreadyClicked) {
          skippedCount++;
          continue;
        }

        // Optimistically mark as clicked to prevent race conditions
        clickedActionsRef.current.add(actionId);
        setClickedActions(new Set(clickedActionsRef.current));

        // Always collect diagnostics for each file operation (no optimization)
        // User preference: prioritize synchronization over performance
        const skipDiagnostics = false;

        // SINGLE-LINE REVIEW CHECK: Detect write_to_file with content on a single line > 200 chars
        if (action.type === "write_to_file") {
          const content = action.params.content || "";
          const isSingleLine = !content.includes("\n") && content.length > 100;
          if (isSingleLine) {
            // Pause and require user review
            wasInterruptedByManual = true;
            setSingleLineReviewActions((prev) => ({
              ...prev,
              [actionId]: {
                action: { ...action, actionId },
                actionId,
                messageId: message.id,
                messageObj: message,
              },
            }));
            setExecutionState({
              total: actions.length,
              completed: index,
              status: EXECUTION_STATUS.IDLE,
            });
            // Remove from clickedActions since we didn't actually execute
            clickedActionsRef.current.delete(actionId);
            setClickedActions(new Set(clickedActionsRef.current));
            break;
          }
        }

        // Check if we should auto-execute this tool
        // 🐛 FIX: Sử dụng currentPermissionMode thay vì permissionModeRef để tránh stale closure
        const decision = getPermissionDecision(
          currentPermissionMode,
          action.type,
        );
        const isConversationAuto =
          conversationToolOverrides[action.type] === "auto";

        const shouldPauseForManual =
          decision === "confirm" && !isConversationAuto;

        if (isAutoTrigger && shouldPauseForManual) {
          wasInterruptedByManual = true;
          // Set to idle so the UI doesn't show loading state falsely
          setExecutionState({
            total: actions.length,
            completed: index,
            status: "idle",
          });
          break;
        }

        let result: string | null = null;
        if (actionType === TOOL_ACTION_TYPES.REJECT) {
          result = `Output: [${action.type}] Tool execution rejected by user.`;
          setRejectedActions((prev) => {
            const next = new Set(prev).add(actionId);
            return next;
          });
          window.postMessage({ command: "markActionRejected", actionId }, "*");
        } else if (decision === TOOL_ACTION_TYPES.REJECT) {
          result = `Output: [${action.type}] Tool execution blocked by permission policy (${permissionModeRef.current}).`;
        } else {
          result = await executeSingleAction(
            { ...action, actionId },
            skipDiagnostics,
            decision === "allow" || isConversationAuto,
          );
        }

        if (result !== null) {
          // Skip display-only tools from auto-flush
          const isDisplayOnly = result === "__DISPLAY_ONLY__";

          if (!isDisplayOnly) {
            validResults.push(result);
          }

          // Update outputs (skip for display-only tools)
          if (!isDisplayOnly) {
            let cleanOutput = result;
            const prefixMatch = result.match(/^\[.*?\] Result:\s*/);
            if (prefixMatch)
              cleanOutput = result.substring(prefixMatch[0].length);
            if (
              cleanOutput.startsWith("```\n") &&
              cleanOutput.endsWith("\n```")
            )
              cleanOutput = cleanOutput.substring(4, cleanOutput.length - 4);
            else if (
              cleanOutput.startsWith("```") &&
              cleanOutput.endsWith("```")
            )
              cleanOutput = cleanOutput.substring(3, cleanOutput.length - 3);

            const isError =
              result.includes("Result: Error") ||
              result.includes("Tool execution blocked") ||
              result.includes("Tool execution rejected");

            // CRITICAL: For run_command, we do NOT overwrite toolOutputs with the formatted 'result'
            // because the Raw Terminal Logs are already being updated in real-time by terminalOutput/commandExecuted events.
            // Overwriting here would inject the "Output: [run_command...]" header and backticks into the TerminalBlock UI.
            // ALSO: For list_files, preserve raw JSON array that was already set
            // ALSO: For view_replace_history, preserve JSON stringified histories array that was already set
            if (
              action.type !== "run_command" &&
              action.type !== "list_files" &&
              action.type !== "view_replace_history"
            ) {
              setToolOutputs((prev) => {
                const existing = prev[actionId];
                return {
                  ...prev,
                  [actionId]: {
                    output: cleanOutput,
                    isError,
                    terminalId: (action as any).params?.terminal_id,
                    // CRITICAL: Preserve diagnostics if they were set earlier
                    diagnostics: existing?.diagnostics,
                  },
                };
              });
            } else {
            }

            const finalTerminalId = (action as any).params?.terminal_id;
            if (finalTerminalId) {
              terminalToActionMap.current.set(finalTerminalId, actionId);
            }
            setExecutionState((prev) => ({
              ...prev,
              completed: prev.completed + 1,
            }));

            // UI Notification
            window.postMessage(
              {
                command: isError ? "markActionFailed" : "markActionClicked",
                actionId,
              },
              "*",
            );
            setClickedActions((prev) => {
              const next = new Set(prev).add(actionId);
              clickedActionsRef.current = next;
              return next;
            });
          }
        } else {
          setExecutionState((prev) => ({ ...prev, status: EXECUTION_STATUS.ERROR }));
          break;
        }
      }

      const allActionsPreSkipped = skippedCount === actions.length;
      if (actionType === "reject") {
      }
      if (allActionsPreSkipped) {
        if (actionType === "reject") {
        }
        setExecutionState((prev) =>
          prev.status === EXECUTION_STATUS.ERROR ? prev : { ...prev, status: EXECUTION_STATUS.DONE },
        );
        return;
      }

      setExecutionState((prev) =>
        prev.status === "error" ? prev : { ...prev, status: "done" },
      );

      // Handle Buffer and Sending
      setAvailableToolResultsBuffer((prev) => {
        const newBuffer = [...(prev[message.id] || []), ...validResults];

        if (wasInterruptedByManual) {
          return { ...prev, [message.id]: newBuffer };
        }

        if (validResults.length < actions.length) {
          const textActionIds = actions.map(
            (a) => `${message.id}-action-${a._index}`,
          );

          // Only send if we have actual results to send (not just display-only tools)
          if (
            newBuffer.length > 0 &&
            handleSendMessageRef.current &&
            !isStoppedRef?.current
          ) {
            const finalContent = newBuffer.join("\n\n");
            handleSendMessageRef.current(
              finalContent,
              undefined,
              undefined,
              undefined,
              true,
              textActionIds,
            );
            return { ...prev, [message.id]: [] };
          }

          // If all actions were display-only, don't send anything, just keep buffer empty
          if (newBuffer.length === 0) {
            return { ...prev, [message.id]: [] };
          }

          return { ...prev, [message.id]: newBuffer };
        }

        const currentMessage = messagesRef?.current.find(
          (m) => m.id === message.id,
        );
        const selectedOption = currentMessage?.selectedOption;
        const parsed = parseAIResponse(message.content);
        const hasQuestion = !!parsed.question;
        // Check if question is answered: legacy selectedOption only
        const isQuestionAnswered = hasQuestion ? !!selectedOption : true;

        const allActionIds = parsed.actions.map(
          (_: any, idx: number) => `${message.id}-action-${idx}`,
        );
        const currentBatchIds = actions.map(
          (a) => `${message.id}-action-${a._index}`,
        );

        const isAllComplete =
          allActionIds.every((id: string) =>
            clickedActionsRef.current.has(id),
          ) && isQuestionAnswered;

        if (isAllComplete && !flushedMessageIdsRef.current.has(message.id)) {
          if (handleSendMessageRef.current && !isStoppedRef?.current) {
            flushedMessageIdsRef.current.add(message.id);
            let finalContent = newBuffer.join("\n\n");
            // Handle question answer - legacy format only
            if (selectedOption) {
              const questionTitle =
                parsed.question?.type === "question"
                  ? (parsed.question as any).title
                  : "Question";
              finalContent = `[question: "${questionTitle || "Question"}"] Answer: ${selectedOption}\n\n${finalContent}`;
            }
            handleSendMessageRef.current(
              finalContent,
              undefined,
              undefined,
              undefined,
              true,
              allActionIds,
              true,
            );
          }
          return { ...prev, [message.id]: [] };
        } else if (flushedMessageIdsRef.current.has(message.id)) {
          return { ...prev, [message.id]: [] };
        } else {
          return { ...prev, [message.id]: newBuffer };
        }
      });

      // Reset isProcessing in parent?
      // This hook does not control isProcessing directly but the parent (ChatPanel/useChatLLM) does.
      // useChatLLM's sendMessage sets isProcessing=true.
      // When sendMessage finishes (after stream), it sets isProcessing=false BUT ONLY IF no tools.
      // If tools, it waits.
      // Here we need to tell parent to stop processing?
      // Actually original code had a timeout to set isProcessing(false).
    },
    [],
  );

  /**
   * Confirm a single-line write_to_file action that was paused for review.
   * Executes the action and processes the result into the buffer for autoReq flush.
   */
  const confirmSingleLineAction = useCallback(
    async (actionId: string) => {
      const reviewEntry = singleLineReviewActions[actionId];
      if (!reviewEntry) return;

      const { action, messageObj } = reviewEntry;

      // Remove from review state
      setSingleLineReviewActions((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });

      // Mark as clicked
      clickedActionsRef.current.add(actionId);
      setClickedActions(new Set(clickedActionsRef.current));

      // Always collect diagnostics for each file operation (no optimization)
      // User preference: prioritize synchronization over performance
      const skipDiagnostics = false;

      // Execute the action
      const result = await executeSingleAction(
        action,
        skipDiagnostics,
        true, // bypassIgnore
      );

      if (result !== null) {
        // Update toolOutputs
        let cleanOutput = result;
        const prefixMatch = result.match(/^\[.*?\] Result:\s*/);
        if (prefixMatch) cleanOutput = result.substring(prefixMatch[0].length);
        if (cleanOutput.startsWith("```\n") && cleanOutput.endsWith("\n```"))
          cleanOutput = cleanOutput.substring(4, cleanOutput.length - 4);
        else if (cleanOutput.startsWith("```") && cleanOutput.endsWith("```"))
          cleanOutput = cleanOutput.substring(3, cleanOutput.length - 3);

        const isError =
          result.includes("Result: Error") ||
          result.includes("Tool execution blocked") ||
          result.includes("Tool execution rejected");

        setToolOutputs((prev) => ({
          ...prev,
          [actionId]: {
            output: cleanOutput,
            isError,
          },
        }));

        window.postMessage(
          {
            command: isError ? "markActionFailed" : "markActionClicked",
            actionId,
          },
          "*",
        );

        // Add to buffer and trigger flush
        setAvailableToolResultsBuffer((prev) => {
          const newBuffer = [...(prev[messageObj.id] || []), result];

          // Check if all actions for this message are complete
          const parsed = parseAIResponse(messageObj.content);
          const allActionIds = parsed.actions.map(
            (_: any, idx: number) => `${messageObj.id}-action-${idx}`,
          );
          const currentMessage = messagesRef?.current.find(
            (m) => m.id === messageObj.id,
          );
          const selectedOption = currentMessage?.selectedOption;
          const hasQuestion = !!parsed.question;
          const isQuestionAnswered = hasQuestion ? !!selectedOption : true;

          const isAllComplete =
            allActionIds.every((id: string) =>
              clickedActionsRef.current.has(id),
            ) && isQuestionAnswered;

          if (
            isAllComplete &&
            !flushedMessageIdsRef.current.has(messageObj.id)
          ) {
            if (handleSendMessageRef.current && !isStoppedRef?.current) {
              flushedMessageIdsRef.current.add(messageObj.id);
              let finalContent = newBuffer.join("\n\n");
              // Handle question answer - legacy format only
              if (selectedOption) {
                const questionTitle =
                  parsed.question?.type === "question"
                    ? (parsed.question as any).title
                    : "Question";
                finalContent = `[question: "${questionTitle || "Question"}"] Answer: ${selectedOption}\n\n${finalContent}`;
              }

              handleSendMessageRef.current(
                finalContent,
                undefined,
                undefined,
                undefined,
                true,
                allActionIds,
                true,
              );
            }
            return { ...prev, [messageObj.id]: [] };
          } else if (flushedMessageIdsRef.current.has(messageObj.id)) {
            return { ...prev, [messageObj.id]: [] };
          } else {
            return { ...prev, [messageObj.id]: newBuffer };
          }
        });
      }
    },
    [singleLineReviewActions, messagesRef],
  );

  /**
   * Reject a single-line write_to_file action that was paused for review.
   * Sends an error message to the AI so it can retry with proper formatting.
   */
  const rejectSingleLineAction = useCallback(
    (actionId: string) => {
      const reviewEntry = singleLineReviewActions[actionId];
      if (!reviewEntry) return;

      const { action, messageObj } = reviewEntry;

      // Remove from review state
      setSingleLineReviewActions((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });

      // Mark as rejected
      setRejectedActions((prev) => new Set(prev).add(actionId));
      window.postMessage({ command: "markActionRejected", actionId }, "*");

      const filePath =
        action.params.file_path || action.params.path || "unknown";
      const errorResult = `[write_to_file for '${filePath}'] Result: Error - Nội dung file bị dồn vào 1 dòng duy nhất (${action.params.content?.length || 0} ký tự). Vui lòng chia lại thành nhiều dòng với ngắt dòng (\\n) thực sự trước khi thực hiện write_to_file.`;

      // Add to buffer and trigger flush so AI gets the error
      setAvailableToolResultsBuffer((prev) => {
        const newBuffer = [...(prev[messageObj.id] || []), errorResult];

        const parsed = parseAIResponse(messageObj.content);
        const allActionIds = parsed.actions.map(
          (_: any, idx: number) => `${messageObj.id}-action-${idx}`,
        );
        const currentMessage = messagesRef?.current.find(
          (m) => m.id === messageObj.id,
        );
        const selectedOption = currentMessage?.selectedOption;
        const hasQuestion = !!parsed.question;
        const isQuestionAnswered = hasQuestion ? !!selectedOption : true;

        const isAllComplete =
          allActionIds.every(
            (id: string) =>
              clickedActionsRef.current.has(id) || id === actionId, // this rejected action counts as done
          ) && isQuestionAnswered;

        if (isAllComplete && !flushedMessageIdsRef.current.has(messageObj.id)) {
          if (handleSendMessageRef.current && !isStoppedRef?.current) {
            flushedMessageIdsRef.current.add(messageObj.id);
            let finalContent = newBuffer.join("\n\n");
            // Handle question answer - legacy format only
            if (selectedOption) {
              const questionTitle =
                parsed.question?.type === "question"
                  ? (parsed.question as any).title
                  : "Question";
              finalContent = `[question: "${questionTitle || "Question"}"] Answer: ${selectedOption}\n\n${finalContent}`;
            }

            handleSendMessageRef.current(
              finalContent,
              undefined,
              undefined,
              undefined,
              true,
              allActionIds,
              true,
            );
          }
          return { ...prev, [messageObj.id]: [] };
        } else if (flushedMessageIdsRef.current.has(messageObj.id)) {
          return { ...prev, [messageObj.id]: [] };
        } else {
          return { ...prev, [messageObj.id]: newBuffer };
        }
      });
    },
    [singleLineReviewActions, messagesRef],
  );

  // 🆕 Auto-flush effect: When messages state changes, check if we can now flush buffered results
  // because a question was finally answered.
  const autoFlushCountRef = useRef(0);
  useEffect(() => {
    // Skip if no buffer to process
    const bufferKeys = Object.keys(availableToolResultsBuffer);
    const hasBuffer = bufferKeys.some(
      (key) => availableToolResultsBuffer[key].length > 0,
    );

    if (!hasBuffer) {
      // No buffer, skip completely - don't even increment counter
      return;
    }

    autoFlushCountRef.current += 1;
    Object.entries(availableToolResultsBuffer).forEach(
      ([messageId, buffer]) => {
        if (buffer.length === 0) return;

        const msg = messagesRef?.current.find((m) => m.id === messageId);
        if (!msg) return;

        const parsed = parseAIResponse(msg.content);
        const hasQuestion = !!parsed.question;
        const isQuestionAnswered = hasQuestion ? !!msg.selectedOption : true;

        const allActionIds = parsed.actions.map(
          (_, idx: number) => `${msg.id}-action-${idx}`,
        );
        const allToolsDone = allActionIds.every((id) =>
          clickedActionsRef.current.has(id),
        );

        if (
          allToolsDone &&
          isQuestionAnswered &&
          !flushedMessageIdsRef.current.has(messageId)
        ) {
          // Flush!
          if (handleSendMessageRef.current && !isStoppedRef?.current) {
            flushedMessageIdsRef.current.add(messageId);
            let finalContent = buffer.join("\n\n");
            // Handle question answer - legacy format only
            if (msg.selectedOption) {
              const questionTitle =
                parsed.question?.type === "question"
                  ? (parsed.question as any).title
                  : "Question";
              finalContent = `[question: "${questionTitle || "Question"}"] Answer: ${msg.selectedOption}\n\n${finalContent}`;
            }

            handleSendMessageRef.current(
              finalContent,
              undefined,
              undefined,
              undefined,
              true,
              allActionIds,
              true,
            );

            // Clear buffer for this message
            setAvailableToolResultsBuffer((prev) => {
              const next = { ...prev };
              delete next[messageId];
              return next;
            });
          }
        }
      },
    );
  }, [messagesRef?.current, clickedActions, availableToolResultsBuffer]);

  return {
    executionState,
    toolOutputs,
    setToolOutputs,
    clickedActions,
    rejectedActions,
    terminalStatus,
    handleToolRequest,
    singleLineReviewActions,
    confirmSingleLineAction,
    rejectSingleLineAction,
  };
};
