import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";
import { Message } from "../../types/message";

import { parseAIResponse } from "../../services/ResponseParser";
import {
  useSettings,
  PermissionMode,
} from "../../../../context/SettingsContext";
import { formatGrepResultCompact } from "../../utils/grepFormatter";
export { getPermissionDecision } from "../../utils/permissionUtils";
import { getPermissionDecision } from "../../utils/permissionUtils";
import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";

// ── Timeout constants ──────────────────────────────────────────────────────
/** Standard timeout for file/git/search operations (ms) */
const TOOL_TIMEOUT_STANDARD = 10_000;
/** Extended timeout for long-running tools: grep, git diff, agent actions (ms) */
const TOOL_TIMEOUT_EXTENDED = 30_000;

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
    status: "idle" | "running" | "error" | "done";
  }>({ total: 0, completed: 0, status: "idle" });

  const [toolOutputs, setToolOutputs] = useState<
    Record<string, { 
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
    }>
  >({});

  const [terminalStatus, setTerminalStatus] = useState<
    Record<string, "busy" | "free">
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
          [message.terminalId]: message.status,
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
            [message.terminalId]: "busy",
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
      const vscodeApi = (window as any).vscodeApi;
      // Or use extensionService.postMessage, but we need generic postMessage.
      // We will use extensionService.postMessage in a real refactor, but for now strict consistency:
      // We'll use extensionService which we defined to behave like vscodeApi.postMessage

      switch (action.type) {
        case "read_file": {
          const requestId = `read-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          const actionId = (action as any).actionId;
          
          console.log(`[useToolExecution][read_file] 📖 Sending readFile request:`, {
            actionId,
            filePath,
            requestId,
          });
          
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
              console.log(`[useToolExecution][read_file] 📥 Received response:`, {
                actionId,
                filePath,
                requestId,
                hasError: !!msg.error,
                hasDiagnostics: !!msg.diagnostics,
                diagnosticsCount: msg.diagnostics?.length || 0,
              });
              
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
                
                // Store output AND diagnostics in toolOutputs
                setToolOutputs((prev) => ({
                  ...prev,
                  [actionId]: {
                    output: content,
                    isError: false,
                    diagnostics: msg.diagnostics || undefined,
                  },
                }));
                
                console.log(`[useToolExecution][read_file] 💾 Stored in toolOutputs:`, {
                  actionId,
                  outputLength: content.length,
                  diagnosticsCount: msg.diagnostics?.length || 0,
                });
                
                resolve(
                  `[read_file for '${filePath}'] Result:\n\`\`\`\n${content}\n\`\`\``,
                );
              }
            },
            TOOL_TIMEOUT_STANDARD,
            () => {
              console.warn(`[read_file] Timeout`, { requestId, filePath });
              resolve(null);
            },
          );
          break;
        }
        case "write_to_file": {
          const requestId = `write-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          extensionService.postMessage({
            command: "writeFile",
            path: filePath,
            content: action.params.content,
            requestId,
            skipDiagnostics,
            bypassIgnore,
            conversationId: conversationIdRef?.current,
            actionId: action.actionId,
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
                resolve(
                  `[write_to_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[write_to_file for '${filePath}'] Result: File written successfully`;
                if (msg.diagnostics?.length > 0)
                  result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
                resolve(result);
              }
            },
            TOOL_TIMEOUT_STANDARD,
            () => {
              console.warn(`[write_to_file] Timeout`, { requestId, filePath });
              resolve(null);
            },
          );
          break;
        }
        case "replace_in_file": {
          const requestId = `replace-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          extensionService.postMessage({
            command: "replaceInFile",
            path: filePath,
            old_str: action.params.old_str,
            new_str: action.params.new_str,
            diff: action.params.diff, // Legacy support
            requestId,
            skipDiagnostics,
            bypassIgnore,
            conversationId: conversationIdRef?.current,
            actionId: action.actionId,
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
                resolve(
                  `[replace_in_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[replace_in_file for '${filePath}'] Result: File updated successfully`;
                if (msg.diagnostics?.length > 0)
                  result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
                resolve(result);
              }
            },
            TOOL_TIMEOUT_STANDARD,
            () => {
              console.warn(`[replace_in_file] Timeout`, {
                requestId,
                filePath,
              });
              resolve(null);
            },
          );
          break;
        }
        case "list_files": {
          const requestId = `list-${Date.now()}-${Math.random()}`;
          const folderPath = action.params.path || action.params.folder_path;
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
              resolve(
                `[list_files for '${folderPath}'] Result:\n\`\`\`\n${Array.isArray(listResults) ? JSON.stringify(listResults, null, 2) : String(listResults)}\n\`\`\``,
              );
            },
            TOOL_TIMEOUT_STANDARD,
            () => resolve(null),
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
            TOOL_TIMEOUT_STANDARD,
            () => resolve(null),
          );
          break;
        }

        case "delete_folder": {
          const requestId = `delete-folder-${Date.now()}-${Math.random()}`;
          const folderPath = action.params.folder_path;
          extensionService.postMessage({
            command: "deleteFolder",
            folder_path: folderPath,
            requestId,
          });
          messageDispatcher.register(
            requestId,
            (msg) => {
              if (msg.error) {
                resolve(
                  `[delete_folder for '${folderPath}'] Result: Error - ${msg.error}`,
                );
                return;
              }
              resolve(
                `[delete_folder for '${folderPath}'] Result: Folder deleted successfully`,
              );
            },
            TOOL_TIMEOUT_STANDARD,
            () => resolve(null),
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
            TOOL_TIMEOUT_STANDARD,
            () => resolve(null),
          );
          break;
        }

        case "grep": {
          const requestId = `grep-${Date.now()}-${Math.random()}`;
          const searchTerm = action.params.search_term;
          const filePath = action.params.file_path;
          const folderPath = action.params.folder_path;
          const targetDesc = filePath || folderPath || "unknown";

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
            TOOL_TIMEOUT_EXTENDED,
            () => {
              console.warn(
                `[Zen][grep] Timeout | requestId=${requestId} | search_term="${searchTerm}" | target="${targetDesc}"`,
              );
              resolve(null);
            },
          );
          break;
        }

        case "git_status":
          // git_status is display-only, no execution needed
          resolve(null);
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
            TOOL_TIMEOUT_EXTENDED,
            () => {
              resolve(null);
            },
          );
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
      actionType?: "accept_all" | "accept_once" | "reject",
    ) => {
      // 🐛 FIX: Đọc permissionMode từ ref đã được update đồng bộ qua useLayoutEffect
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
        status: "running",
      });

      for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        const actionId =
          action.actionId || `${message.id}-action-${action._index}`;

        // DEBUG: Log chi tiết cho tất cả các action

        // GUARD: Prevent duplicate execution of same action Id
        // 🐛 FIX: Khi reject, KHÔNG skip action dù đã có trong clickedActionsRef
        const isReject = actionType === "reject";
        const isAlreadyClicked = clickedActionsRef.current.has(actionId);
        if (!isReject && isAlreadyClicked) {
          skippedCount++;
          continue;
        }

        // Optimistically mark as clicked to prevent race conditions
        clickedActionsRef.current.add(actionId);
        setClickedActions(new Set(clickedActionsRef.current));

        // Skip diagnostics logic optimization
        const isEditAction =
          action.type === "replace_in_file" || action.type === "write_to_file";
        let skipDiagnostics = false;
        if (isEditAction) {
          const currentPath = action.params.path;
          const subsequentActions = actions.slice(index + 1);
          skipDiagnostics = subsequentActions.some(
            (a) =>
              (a.type === "replace_in_file" || a.type === "write_to_file") &&
              a.params.path === currentPath,
          );
        }

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
              status: "idle",
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
          decision === "prompt" && !isConversationAuto;

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
        if (actionType === "reject") {
          result = `Output: [${action.type}] Tool execution rejected by user.`;
          setRejectedActions((prev) => {
            const next = new Set(prev).add(actionId);
            return next;
          });
          window.postMessage({ command: "markActionRejected", actionId }, "*");
        } else if (decision === "deny") {
          result = `Output: [${action.type}] Tool execution blocked by permission policy (${permissionModeRef.current}).`;
        } else {
          result = await executeSingleAction(
            { ...action, actionId },
            skipDiagnostics,
            decision === "allow" || isConversationAuto,
          );
        }

        if (result !== null) {
          validResults.push(result);

          // Update outputs
          let cleanOutput = result;
          const prefixMatch = result.match(/^\[.*?\] Result:\s*/);
          if (prefixMatch)
            cleanOutput = result.substring(prefixMatch[0].length);
          if (cleanOutput.startsWith("```\n") && cleanOutput.endsWith("\n```"))
            cleanOutput = cleanOutput.substring(4, cleanOutput.length - 4);
          else if (cleanOutput.startsWith("```") && cleanOutput.endsWith("```"))
            cleanOutput = cleanOutput.substring(3, cleanOutput.length - 3);

          const isError =
            result.includes("Result: Error") ||
            result.includes("Tool execution blocked") ||
            result.includes("Tool execution rejected");

          // CRITICAL: For run_command, we do NOT overwrite toolOutputs with the formatted 'result'
          // because the Raw Terminal Logs are already being updated in real-time by terminalOutput/commandExecuted events.
          // Overwriting here would inject the "Output: [run_command...]" header and backticks into the TerminalBlock UI.
          if (action.type !== "run_command") {
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: cleanOutput,
                isError,
                terminalId: (action as any).params?.terminal_id,
              },
            }));
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
        } else {
          setExecutionState((prev) => ({ ...prev, status: "error" }));
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
          prev.status === "error" ? prev : { ...prev, status: "done" },
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
          if (handleSendMessageRef.current && !isStoppedRef?.current) {
            const finalContent = newBuffer.join("\n\n");
            handleSendMessageRef.current(
              finalContent,
              undefined,
              undefined,
              undefined,
              true,
              textActionIds,
            );
          }
          return { ...prev, [message.id]: [] };
        }

        const currentMessage = messagesRef?.current.find(
          (m) => m.id === message.id,
        );
        const selectedOption = currentMessage?.selectedOption;
        const questionAnswers = currentMessage?.questionAnswers;
        const parsed = parseAIResponse(message.content);
        const hasQuestion = !!parsed.question;
        // Check if question is answered: either legacy selectedOption or new questionAnswers
        const isQuestionAnswered = hasQuestion
          ? !!(
              selectedOption ||
              (questionAnswers && Object.keys(questionAnswers).length > 0)
            )
          : true;

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
            // Handle question answers - both legacy and new
            if (questionAnswers && Object.keys(questionAnswers).length > 0) {
              // New paginated format: send all answers
              const answerLines = Object.entries(questionAnswers).map(
                ([qId, answer]) => {
                  const q = (parsed.question as any)?.questions?.find(
                    (q: any) => q.id === qId,
                  );
                  const label = q?.label || qId;
                  let valueStr = answer.value;
                  if (Array.isArray(valueStr)) {
                    valueStr = valueStr.join(", ");
                  } else if (typeof valueStr === "boolean") {
                    valueStr = valueStr ? "Yes" : "No";
                  }
                  return `[question: "${label}"] Answer: ${valueStr}`;
                },
              );
              if (answerLines.length > 0) {
                finalContent = answerLines.join("\n\n") + "\n\n" + finalContent;
              }
            } else if (selectedOption) {
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

      // Determine skipDiagnostics
      const parsed = parseAIResponse(messageObj.content);
      const allActions = parsed.actions;
      const actionIdx = allActions.findIndex(
        (_a: any, i: number) => `${messageObj.id}-action-${i}` === actionId,
      );
      let skipDiagnostics = false;
      if (actionIdx !== -1) {
        const currentPath = action.params.path || action.params.file_path;
        const subsequentActions = allActions.slice(actionIdx + 1);
        skipDiagnostics = subsequentActions.some(
          (a: any) =>
            (a.type === "replace_in_file" || a.type === "write_to_file") &&
            (a.params.path || a.params.file_path) === currentPath,
        );
      }

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
          const questionAnswers = currentMessage?.questionAnswers;
          const hasQuestion = !!parsed.question;
          const isQuestionAnswered = hasQuestion
            ? !!(
                selectedOption ||
                (questionAnswers && Object.keys(questionAnswers).length > 0)
              )
            : true;

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
              // Handle question answers - both legacy and new
              if (questionAnswers && Object.keys(questionAnswers).length > 0) {
                const answerLines = Object.entries(questionAnswers).map(
                  ([qId, answer]) => {
                    const q = (parsed.question as any)?.questions?.find(
                      (q: any) => q.id === qId,
                    );
                    const label = q?.label || qId;
                    let valueStr = answer.value;
                    if (Array.isArray(valueStr)) {
                      valueStr = valueStr.join(", ");
                    } else if (typeof valueStr === "boolean") {
                      valueStr = valueStr ? "Yes" : "No";
                    }
                    return `[question: "${label}"] Answer: ${valueStr}`;
                  },
                );
                if (answerLines.length > 0) {
                  finalContent =
                    answerLines.join("\n\n") + "\n\n" + finalContent;
                }
              } else if (selectedOption) {
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
        const questionAnswers = currentMessage?.questionAnswers;
        const hasQuestion = !!parsed.question;
        const isQuestionAnswered = hasQuestion
          ? !!(
              selectedOption ||
              (questionAnswers && Object.keys(questionAnswers).length > 0)
            )
          : true;

        const isAllComplete =
          allActionIds.every(
            (id: string) =>
              clickedActionsRef.current.has(id) || id === actionId, // this rejected action counts as done
          ) && isQuestionAnswered;

        if (isAllComplete && !flushedMessageIdsRef.current.has(messageObj.id)) {
          if (handleSendMessageRef.current && !isStoppedRef?.current) {
            flushedMessageIdsRef.current.add(messageObj.id);
            let finalContent = newBuffer.join("\n\n");
            // Handle question answers - both legacy and new
            if (questionAnswers && Object.keys(questionAnswers).length > 0) {
              const answerLines = Object.entries(questionAnswers).map(
                ([qId, answer]) => {
                  const q = (parsed.question as any)?.questions?.find(
                    (q: any) => q.id === qId,
                  );
                  const label = q?.label || qId;
                  let valueStr = answer.value;
                  if (Array.isArray(valueStr)) {
                    valueStr = valueStr.join(", ");
                  } else if (typeof valueStr === "boolean") {
                    valueStr = valueStr ? "Yes" : "No";
                  }
                  return `[question: "${label}"] Answer: ${valueStr}`;
                },
              );
              if (answerLines.length > 0) {
                finalContent = answerLines.join("\n\n") + "\n\n" + finalContent;
              }
            } else if (selectedOption) {
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
  useEffect(() => {
    Object.entries(availableToolResultsBuffer).forEach(
      ([messageId, buffer]) => {
        if (buffer.length === 0) return;

        const msg = messagesRef?.current.find((m) => m.id === messageId);
        if (!msg) return;

        const parsed = parseAIResponse(msg.content);
        const hasQuestion = !!parsed.question;
        const isQuestionAnswered = hasQuestion
          ? !!(
              msg.selectedOption ||
              (msg.questionAnswers &&
                Object.keys(msg.questionAnswers).length > 0)
            )
          : true;

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
            // Handle question answers - both legacy and new
            if (
              msg.questionAnswers &&
              Object.keys(msg.questionAnswers).length > 0
            ) {
              const answerLines = Object.entries(msg.questionAnswers).map(
                ([qId, answer]) => {
                  const q = (parsed.question as any)?.questions?.find(
                    (q: any) => q.id === qId,
                  );
                  const label = q?.label || qId;
                  let valueStr = answer.value;
                  if (Array.isArray(valueStr)) {
                    valueStr = valueStr.join(", ");
                  } else if (typeof valueStr === "boolean") {
                    valueStr = valueStr ? "Yes" : "No";
                  }
                  return `[question: "${label}"] Answer: ${valueStr}`;
                },
              );
              if (answerLines.length > 0) {
                finalContent = answerLines.join("\n\n") + "\n\n" + finalContent;
              }
            } else if (msg.selectedOption) {
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
