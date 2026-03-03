import { useState, useRef, useCallback, useEffect } from "react";
import { Message } from "../components/ChatPanel/ChatBody/types";
import { extensionService } from "../services/ExtensionService";
import { ToolAction, parseAIResponse } from "../services/ResponseParser";
import { MANUAL_CONFIRMATION_TOOLS } from "../components/ChatPanel/ChatBody/constants";
import { stripAnsi, stripMarkers } from "../utils/terminalUtils";

interface UseToolExecutionProps {
  sendMessage: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipFirstRequestLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
    thinking?: boolean,
  ) => Promise<void>;
  conversationIdRef?: React.MutableRefObject<string>;
}

export const useToolExecution = ({
  sendMessage,
  conversationIdRef,
}: UseToolExecutionProps) => {
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
          } else {
            console.warn(
              "[useToolExecution] Cannot save terminal output: conversationId (from Ref) is missing",
            );
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

              const timeSuffix = duration ? ` for ${duration}s` : "";
              const terminalSuffix = message.terminalId
                ? ` on terminal ${message.terminalId}`
                : "";
              const outputTag = ` with "terminal_output-${outputUuid}"`;

              const resultMsg = message.error
                ? `Output: [run_command for '${cmdText}'${terminalSuffix}]${timeSuffix}${outputTag}\n\`\`\`\nError: ${message.error}\n${outputContent}\n\`\`\``
                : `Output: [run_command for '${cmdText}'${terminalSuffix}]${timeSuffix}${outputTag}\n\`\`\`\n${outputContent}\n\`\`\``;

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
          extensionService.postMessage({
            command: "writeFile",
            path: filePath,
            content: action.params.content,
            requestId: requestId,
            skipDiagnostics,
          });

          const handleResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "writeFileResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleResponse);
              if (msg.error) {
                resolve(
                  `[write_to_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[write_to_file for '${filePath}'] Success: File written successfully`;
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
            resolve(null);
          }, 10000);
          break;
        }
        case "replace_in_file": {
          const requestId = `replace-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
          extensionService.postMessage({
            command: "replaceInFile",
            path: filePath,
            diff: action.params.diff,
            requestId: requestId,
            skipDiagnostics,
          });

          const handleReplaceResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "replaceInFileResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleReplaceResponse);
              if (msg.error) {
                resolve(
                  `[replace_in_file for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[replace_in_file for '${filePath}'] Success: Diff applied successfully`;
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
            type: action.params.type,
            requestId: requestId,
          });
          const handleListResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "listFilesResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleListResponse);
              console.log("[useToolExecution] listFiles result received:", msg);
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
                resolve(
                  `[search_files for '${folderPath}'] Result:\n\`\`\`\n${msg.results}\n\`\`\``,
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

        case "get_symbol_definition": {
          const requestId = `def-${Date.now()}-${Math.random()}`;
          extensionService.postMessage({
            command: "getSymbolDefinition",
            symbol: action.params.symbol,
            path: action.params.file_path,
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
                  `[get_symbol_definition for '${action.params.symbol}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[get_symbol_definition for '${action.params.symbol}'] Result:\n\`\`\`\n${msg.result}\n\`\`\``,
                );
              }
            }
          };
          window.addEventListener("message", handleDefResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleDefResponse);
            resolve(null);
          }, 10000);
          break;
        }

        case "get_references": {
          const requestId = `ref-${Date.now()}-${Math.random()}`;
          extensionService.postMessage({
            command: "getReferences",
            symbol: action.params.symbol,
            path: action.params.file_path,
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
                  `[get_references for '${action.params.symbol}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[get_references for '${action.params.symbol}'] Result:\n\`\`\`\n${msg.result}\n\`\`\``,
                );
              }
            }
          };
          window.addEventListener("message", handleRefResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleRefResponse);
            resolve(null);
          }, 10000);
          break;
        }

        case "get_file_outline": {
          const requestId = `outline-${Date.now()}-${Math.random()}`;
          const filePath = action.params.path || action.params.file_path;
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
                  `[get_file_outline for '${filePath}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[get_file_outline for '${filePath}'] Result:\n\`\`\`\n${msg.result}\n\`\`\``,
                );
              }
            }
          };
          window.addEventListener("message", handleOutlineResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleOutlineResponse);
            resolve(null);
          }, 10000);
          break;
        }

        case "ask_bypass_gitignore": {
          const requestId = `bypass-${Date.now()}-${Math.random()}`;
          const pathValue = action.params.path;
          extensionService.postMessage({
            command: "askBypassGitignore",
            path: pathValue,
            requestId: requestId,
          });

          const handleBypassResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "askBypassGitignoreResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handleBypassResponse);
              if (msg.error) {
                resolve(
                  `[ask_bypass_gitignore for '${pathValue}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[ask_bypass_gitignore for '${pathValue}'] Result: Bypass approved for current conversation. You can now access this path.`,
                );
              }
            }
          };
          window.addEventListener("message", handleBypassResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleBypassResponse);
            resolve(null);
          }, 10000);
          break;
        }

        case "read_workspace_context": {
          const requestId = `read-workspace-${Date.now()}-${Math.random()}`;
          extensionService.postMessage({
            command: "readFile",
            path: "workspace.md",
            requestId: requestId,
          });

          const handleReadWorkspaceResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === "fileContent" && msg.requestId === requestId) {
              window.removeEventListener(
                "message",
                handleReadWorkspaceResponse,
              );
              if (msg.error) {
                let readableError = msg.error;
                if (
                  readableError.includes("tồn tại") ||
                  readableError.includes("no such file")
                ) {
                  readableError = "workspace.md not found in project context";
                }
                resolve(
                  `[read_workspace_context] Result: Error - ${readableError}`,
                );
              } else {
                let result = `[read_workspace_context] Result:\n\`\`\`\n${msg.content}\n\`\`\``;
                resolve(result);
              }
            }
          };
          window.addEventListener("message", handleReadWorkspaceResponse);
          setTimeout(() => {
            window.removeEventListener("message", handleReadWorkspaceResponse);
            resolve(null);
          }, 10000);
          break;
        }

        case "update_workspace_context": {
          const requestId = `update-workspace-${Date.now()}-${Math.random()}`;

          extensionService.postMessage({
            command: "replaceInFile",
            path: "workspace.md",
            diff: action.params.diff,
            requestId: requestId,
            skipDiagnostics: true,
          });

          const handleUpdateWorkspaceResponse = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "replaceInFileResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener(
                "message",
                handleUpdateWorkspaceResponse,
              );
              if (msg.error) {
                resolve(
                  `[update_workspace_context] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[update_workspace_context] Success: Workspace context updated successfully`;
                resolve(result);
              }
            }
          };
          window.addEventListener("message", handleUpdateWorkspaceResponse);
          setTimeout(() => {
            window.removeEventListener(
              "message",
              handleUpdateWorkspaceResponse,
            );
            resolve(null);
          }, 10000);
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
          console.warn(`[useToolExecution] Unknown tool type: ${action.type}`);
          resolve(null);
      }
    });
  };

  const handleToolRequest = useCallback(
    async (
      actionOrActions: any,
      message: Message,
      isAutoTrigger: boolean = false,
    ) => {
      let wasInterruptedByManual = false;

      const actions = (
        Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
      ).map((a, idx) => ({
        ...a,
        _index: a._index !== undefined ? a._index : idx,
      }));

      // Validation check for duplicate actions or re-runs if needed (omitted for brevity)

      const validResults: string[] = [];
      setExecutionState({
        total: actions.length,
        completed: 0,
        status: "running",
      });

      for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        const actionId = `${message.id}-action-${action._index}`;

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
        const isManual = MANUAL_CONFIRMATION_TOOLS.includes(action.type);
        if (isAutoTrigger && isManual) {
          wasInterruptedByManual = true;
          // Set to idle so the UI doesn't show loading state falsely
          setExecutionState({
            total: actions.length,
            completed: index,
            status: "idle",
          });
          break;
        }

        const result = await executeSingleAction(
          { ...action, actionId },
          skipDiagnostics,
        );

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

          const isError = result.includes("Result: Error");

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

      setExecutionState((prev) =>
        prev.status === "error" ? prev : { ...prev, status: "done" },
      );

      // Handle Buffer and Sending
      setAvailableToolResultsBuffer((prev) => {
        const newBuffer = [...(prev[message.id] || []), ...validResults];

        if (wasInterruptedByManual) {
          // We stopped executing because we hit a manual tool.
          // Keep the buffer and do NOT trigger LLM yet. Let the user click the manual tool.
          return { ...prev, [message.id]: newBuffer };
        }

        if (validResults.length < actions.length) {
          // Error case in THIS batch, flush immediately to inform AI
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

        // Check overall completeness across the entire message
        const parsed = parseAIResponse(message.content);
        const allActionIds = parsed.actions.map(
          (_: any, idx: number) => `${message.id}-action-${idx}`,
        );
        const currentBatchIds = actions.map(
          (a) => `${message.id}-action-${a._index}`,
        );

        const isAllComplete = allActionIds.every(
          (id: string) =>
            clickedActionsRef.current.has(id) || currentBatchIds.includes(id),
        );

        if (isAllComplete) {
          if (handleSendMessageRef.current) {
            handleSendMessageRef.current(
              newBuffer.join("\n\n"),
              undefined,
              undefined,
              undefined,
              true,
              allActionIds,
              true,
            );
          }
          return { ...prev, [message.id]: [] };
        } else {
          // Not all actions in this message are complete yet. Wait for the user to execute the rest.
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

  return {
    executionState,
    toolOutputs,
    clickedActions,
    terminalStatus,
    handleToolRequest,
  };
};
