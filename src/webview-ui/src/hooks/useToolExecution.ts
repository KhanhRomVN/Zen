import { useState, useRef, useCallback, useEffect } from "react";
import { Message } from "../components/ChatPanel/ChatBody/types";
import { extensionService } from "../services/ExtensionService";
import { ToolAction, parseAIResponse } from "../services/ResponseParser";
import { stripAnsi, stripMarkers } from "../utils/terminalUtils";
import { useSettings, PermissionMode } from "../context/SettingsContext";

export const getPermissionDecision = (
  mode: PermissionMode,
  toolType: string
): "allow" | "prompt" | "deny" => {
  switch (mode) {
    case "bypassPermissions":
      return "allow";
    case "acceptEdits":
      if (["read_file", "list_files", "search_files", "search_content", "write_to_file", "replace_in_file", "get_outline", "get_definition", "get_references"].includes(toolType)) {
        return "allow";
      }
      return "prompt";
    case "auto":
      if (["read_file", "list_files", "search_files", "search_content", "get_outline", "get_definition", "get_references"].includes(toolType)) {
        return "allow";
      }
      return "prompt";
    case "plan":
      if (["read_file", "list_files", "search_files", "search_content", "get_outline", "get_definition", "get_references"].includes(toolType)) {
        return "allow";
      }
      return "deny";
    default:
      return "prompt";
  }
};

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
}

export const useToolExecution = ({
  sendMessage,
  conversationIdRef,
  messagesRef,
}: UseToolExecutionProps) => {
  const { permissionMode } = useSettings();
  const [executionState, setExecutionState] = useState<{
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  }>({ total: 0, completed: 0, status: "idle" });

  const [toolOutputs, setToolOutputs] = useState<
    Record<string, { output: string; isError: boolean; terminalId?: string }>
  >({});

  const [terminalStatus, setTerminalStatus] = useState<
    Record<string, "busy" | "free">
  >({});

  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());

  const clickedActionsRef = useRef<Set<string>>(new Set());
  const pendingToolResolvers = useRef<
    Map<string, (result: string | null) => void>
  >(new Map());
  const commandStartTimes = useRef<Map<string, number>>(new Map());
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

            // 🛡️ SMART MERGE: Terminal output is additive.
            // In case of race conditions or incomplete extension logs,
            // always prioritize the LONGEST version to avoid content disappearance.
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

          // [New] Persistent Terminal Color Storage
          // Create UUID once for this execution
          const outputUuid = crypto.randomUUID();

          // Save raw ANSI output immediately (even for manual runs)
          const effectiveChatUuid = conversationIdRef?.current;

          if (effectiveChatUuid) {
            extensionService.postMessage({
              command: "saveTerminalOutput",
              chatUuid: effectiveChatUuid,
              outputUuid,
              content: message.output, // Keep original ANSI color output
            });
          }

          if (pendingToolResolvers.current.has(message.actionId)) {
            const resolver = pendingToolResolvers.current.get(message.actionId);
            if (resolver) {
              // Clear mapping so future terminal output (like 'clear') doesn't update this block
              if (message.terminalId) {
                terminalToActionMap.current.delete(message.terminalId);
              }

              const cmdText =
                message.commandText || message.commandTextRaw || "command";
              const outputRaw = message.output ? message.output : "";

              // Use the smarter stripMarkers utility instead of aggressive substring
              // This preserves prompt and command echo while removing technical markers.
              let outputContent = stripMarkers(outputRaw, message.actionId);
              outputContent = outputContent.trim();

              const startTime = commandStartTimes.current.get(message.actionId);
              const duration = startTime
                ? ((Date.now() - startTime) / 1000).toFixed(1)
                : null;

              if (startTime) {
                commandStartTimes.current.delete(message.actionId);
              }

              const resultMsg = message.error
                ? `Output: [run_command for '${cmdText}'] Error - ${message.error} with "terminal_output-${outputUuid}"\n\`\`\`\n${outputContent}\n\`\`\``
                : `Output: [run_command for '${cmdText}'] with "terminal_output-${outputUuid}"\n\`\`\`\n${outputContent}\n\`\`\``;

              resolver(resultMsg);
              pendingToolResolvers.current.delete(message.actionId);
            }
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
          extensionService.postMessage({
            command: "readFile",
            path: filePath,
            startLine: action.params.start_line
              ? parseInt(action.params.start_line)
              : undefined,
            endLine: action.params.end_line
              ? parseInt(action.params.end_line)
              : undefined,
            requestId: requestId,
            bypassIgnore,
          });

          const handleFileResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === "fileContent" && msg.requestId === requestId) {
              window.removeEventListener("message", handleFileResponse);
              if (msg.error) {
                let readableError = msg.error;
                if (
                  readableError.includes("tồn tại") ||
                  readableError.includes("no such file")
                ) {
                  readableError = "File not found in project";
                }
                resolve(
                  `[read_file for '${filePath}'] Result: Error - ${readableError}`,
                );
              } else {
                let result = `[read_file for '${filePath}'] Result:\n\`\`\`\n${msg.content}\n\`\`\``;
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                  result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
                }
                resolve(result);
              }
            }
          };
          window.addEventListener("message", handleFileResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleFileResponse);
            resolve(null);
          }, 10000);
          break;
        }
        case "write_to_file": {
          const requestId = `write-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          console.log(`[write_to_file] Sending request`, { requestId, filePath, contentLength: action.params.content?.length });
          extensionService.postMessage({
            command: "writeFile",
            path: filePath,
            content: action.params.content,
            requestId: requestId,
            skipDiagnostics,
            bypassIgnore,
            conversationId: conversationIdRef?.current,
          });

          const handleResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "writeFileResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleResponse);
              if (msg.error) {
                console.error(`[write_to_file] Error response`, { requestId, filePath, error: msg.error });
                resolve(
                  `[write_to_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                console.log(`[write_to_file] Success response`, { requestId, filePath, hasDiagnostics: !!(msg.diagnostics?.length) });
                let result = `[write_to_file for '${filePath}'] Result: File written successfully`;
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                  result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
                }
                resolve(result);
              }
            }
          };
          window.addEventListener("message", handleResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleResponse);
            console.warn(`[write_to_file] Timeout waiting for response`, { requestId, filePath });
            resolve(null);
          }, 10000);
          break;
        }
        case "replace_in_file": {
          const requestId = `replace-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          console.log(`[replace_in_file] Sending request`, { requestId, filePath, diffLength: action.params.diff?.length });
          extensionService.postMessage({
            command: "replaceInFile",
            path: filePath,
            diff: action.params.diff,
            requestId: requestId,
            skipDiagnostics,
            bypassIgnore,
            conversationId: conversationIdRef?.current,
          });

          const handleReplaceResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "replaceInFileResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleReplaceResponse);
              if (msg.error) {
                console.error(`[replace_in_file] Error response`, { requestId, filePath, error: msg.error });
                resolve(
                  `[replace_in_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                console.log(`[replace_in_file] Success response`, { requestId, filePath, hasDiagnostics: !!(msg.diagnostics?.length) });
                let result = `[replace_in_file for '${filePath}'] Result: Diff applied successfully`;
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                  result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
                  if (msg.content) {
                    result += `\n\n<current_file_content_post_edit>\n(The following is the full content of '${filePath}' AFTER the edit. Please review it to fix the diagnostics.)\n\`\`\`\n${msg.content}\n\`\`\`\n</current_file_content_post_edit>`;
                  }
                }
                resolve(result);
              }
            }
          };
          window.addEventListener("message", handleReplaceResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleReplaceResponse);
            console.warn(`[replace_in_file] Timeout waiting for response`, { requestId, filePath });
            resolve(null);
          }, 10000);
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
            requestId: requestId,
            bypassIgnore,
          });
          const handleListResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "listFilesResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleListResponse);
              if (msg.error) {
                resolve(
                  `[list_files for '${folderPath}'] Result: Error - ${msg.error}`,
                );
              } else {
                const listResults = msg.files || msg.results;
                const formattedOutput = Array.isArray(listResults)
                  ? JSON.stringify(listResults, null, 2)
                  : String(listResults);

                resolve(
                  `[list_files for '${folderPath}'] Result:\n\`\`\`\n${formattedOutput}\n\`\`\``,
                );
              }
            }
          };
          window.addEventListener("message", handleListResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleListResponse);
            resolve(null);
          }, 10000);
          break;
        }
        case "search_files": {
          const requestId = `search-${Date.now()}-${Math.random()}`;
          const folderPath = action.params.path || action.params.folder_path;
          extensionService.postMessage({
            command: "searchFiles",
            path: folderPath,
            regex: action.params.regex,
            filePattern: action.params.filePattern,
            requestId: requestId,
            bypassIgnore,
          });
          const handleSearchResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "searchFilesResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleSearchResponse);
              if (msg.error) {
                resolve(
                  `[search_files for '${folderPath}'] Result: Error - ${msg.error}`,
                );
              } else {
                const formattedResults = Array.isArray(msg.results)
                  ? msg.results.join("\n")
                  : String(msg.results);
                resolve(
                  `[search_files for '${folderPath}'] Result:\n\`\`\`\n${formattedResults}\n\`\`\``,
                );
              }
            }
          };
          window.addEventListener("message", handleSearchResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleSearchResponse);
            resolve(null);
          }, 10000);
          break;
        }
        case "search_content": {
          const requestId = `search-content-${Date.now()}-${Math.random()}`;
          const folderPath = action.params.folder_path || action.params.path;
          extensionService.postMessage({
            command: "searchContent",
            folder_path: folderPath,
            pattern: action.params.pattern,
            file_pattern: action.params.file_pattern,
            requestId,
            bypassIgnore,
          });
          const handleSearchContentResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === "searchContentResult" && msg.requestId === requestId) {
              window.removeEventListener("message", handleSearchContentResponse);
              if (msg.error) {
                resolve(`[search_content for '${folderPath}'] Result: Error - ${msg.error}`);
              } else {
                const formatted = Array.isArray(msg.results)
                  ? msg.results.join("\n")
                  : String(msg.results);
                resolve(`[search_content for '${folderPath}'] Result:\n\`\`\`\n${formatted}\n\`\`\``);
              }
            }
          };
          window.addEventListener("message", handleSearchContentResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleSearchContentResponse);
            resolve(null);
          }, 10000);
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
          pendingToolResolvers.current.set(actionId, resolve);

          break;
        }

        case "get_outline": {
          const requestId = `outline-${Date.now()}-${Math.random()}`;
          const filePath = action.params.file_path || action.params.path;
          extensionService.postMessage({
            command: "getFileOutline",
            path: filePath,
            requestId: requestId,
          });

          const handleOutlineResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "getFileOutlineResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleOutlineResponse);
              if (msg.error) {
                resolve(
                  `[get_outline for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[get_outline for '${filePath}'] Result:\n\`\`\`\n${msg.result}\n\`\`\``,
                );
              }
            }
          };
          window.addEventListener("message", handleOutlineResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleOutlineResponse);
            resolve(null);
          }, 15000);
          break;
        }

        case "get_definition": {
          const requestId = `definition-${Date.now()}-${Math.random()}`;
          const symbol = action.params.symbol;
          const filePath = action.params.file_path || action.params.path;
          extensionService.postMessage({
            command: "getSymbolDefinition",
            symbol: symbol,
            path: filePath,
            requestId: requestId,
          });

          const handleDefResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "getSymbolDefinitionResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleDefResponse);
              if (msg.error) {
                resolve(
                  `[get_definition for '${symbol}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[get_definition for '${symbol}'] Result:\n${msg.result}`,
                );
              }
            }
          };
          window.addEventListener("message", handleDefResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleDefResponse);
            resolve(null);
          }, 15000);
          break;
        }

        case "get_references": {
          const requestId = `references-${Date.now()}-${Math.random()}`;
          const symbol = action.params.symbol;
          const filePath = action.params.file_path || action.params.path;
          extensionService.postMessage({
            command: "getReferences",
            symbol: symbol,
            path: filePath,
            requestId: requestId,
          });

          const handleRefResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "getReferencesResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleRefResponse);
              if (msg.error) {
                resolve(
                  `[get_references for '${symbol}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[get_references for '${symbol}'] Result:\n${msg.result}`,
                );
              }
            }
          };
          window.addEventListener("message", handleRefResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleRefResponse);
            resolve(null);
          }, 15000);
          break;
        }

        case "execute_agent_action": {
          const requestId = `agent-${Date.now()}-${Math.random()}`;
          extensionService.postMessage({
            command: "executeAgentAction",
            action: {
              ...action.params,
              requestId,
            },
          });

          const handleAgentResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "agentActionResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleAgentResponse);
              if (msg.result.success) {
                resolve(
                  `[execute_agent_action] Success:\n\`\`\`\n${JSON.stringify(msg.result.data, null, 2)}\n\`\`\``,
                );
              } else {
                resolve(
                  `[execute_agent_action] Result: Error - ${msg.result.error}`,
                );
              }
            }
          };
          window.addEventListener("message", handleAgentResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleAgentResponse);
            resolve(null);
          }, 30000); // Longer timeout for agent actions
          break;
        }
        default:
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
      let wasInterruptedByManual = false;

      const actions = (
        Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
      ).map((a, idx) => ({
        ...a,
        _index: a._index !== undefined ? a._index : idx,
      }));

      // Validation check for duplicate actions or re-runs if needed (omitted for brevity)

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

        // GUARD: Prevent duplicate execution of same action Id
        if (clickedActionsRef.current.has(actionId)) {
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

        // Check if we should auto-execute this tool
        const decision = getPermissionDecision(permissionMode, action.type);
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
        } else if (decision === "deny") {
          result = `Output: [${action.type}] Tool execution blocked by permission policy (${permissionMode}).`;
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
      if (allActionsPreSkipped) {
        setExecutionState((prev) => prev.status === "error" ? prev : { ...prev, status: "done" });
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
          if (handleSendMessageRef.current) {
            handleSendMessageRef.current(
              newBuffer.join("\n\n"),
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
        const parsed = parseAIResponse(message.content);
        const hasQuestion = !!parsed.question;
        const isQuestionAnswered = hasQuestion ? !!selectedOption : true;

        const allActionIds = parsed.actions.map(
          (_: any, idx: number) => `${message.id}-action-${idx}`,
        );
        const currentBatchIds = actions.map(
          (a) => `${message.id}-action-${a._index}`,
        );

        const isAllComplete =
          allActionIds.every(
            (id: string) => clickedActionsRef.current.has(id),
          ) && isQuestionAnswered;

        if (isAllComplete && !flushedMessageIdsRef.current.has(message.id)) {
          if (handleSendMessageRef.current) {
            flushedMessageIdsRef.current.add(message.id);
            let finalContent = newBuffer.join("\n\n");
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
          if (handleSendMessageRef.current) {
            flushedMessageIdsRef.current.add(messageId);
            let finalContent = buffer.join("\n\n");
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
    clickedActions,
    terminalStatus,
    handleToolRequest,
  };
};
