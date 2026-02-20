import { useState, useRef, useCallback, useEffect } from "react";
import { Message } from "../components/ChatPanel/ChatBody/types";
import { extensionService } from "../services/ExtensionService";
import { ToolAction } from "../services/ResponseParser";

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
}

export const useToolExecution = ({ sendMessage }: UseToolExecutionProps) => {
  const [executionState, setExecutionState] = useState<{
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  }>({ total: 0, completed: 0, status: "idle" });

  const [toolOutputs, setToolOutputs] = useState<
    Record<string, { output: string; isError: boolean }>
  >({});

  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  const [clearedActions, setClearedActions] = useState<Set<string>>(new Set());

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

      if (message.command === "markActionCleared" && message.actionId) {
        setClearedActions((prev) => new Set(prev).add(message.actionId));
        // Note: Clearing content of messages is UI concern, usually passed down or handled by message list state.
        // But here we only track IDs. The actual message content clearing needs access to setMessages.
        // We might need to expose this event or handle it in ChatPanel.
        // For now, we just track cleared Actions state.
      } else if (message.command === "commandExecuted") {
        if (message.actionId) {
          setToolOutputs((prev) => ({
            ...prev,
            [message.actionId]: {
              output: message.output,
              isError: !!message.error,
            },
          }));

          if (pendingToolResolvers.current.has(message.actionId)) {
            const resolver = pendingToolResolvers.current.get(message.actionId);
            if (resolver) {
              const cmdText = message.commandText || "command";
              const outputContent = message.output ? message.output.trim() : "";

              const startTime = commandStartTimes.current.get(message.actionId);
              const duration = startTime
                ? ((Date.now() - startTime) / 1000).toFixed(1)
                : null;

              if (startTime) {
                commandStartTimes.current.delete(message.actionId);
              }
              const timeSuffix = duration ? ` for ${duration}s` : "";
              const resultMsg = message.error
                ? `Output: [execute_command for '${cmdText}']${timeSuffix}\n\`\`\`\nError: ${message.error}\n${outputContent}\n\`\`\``
                : `Output: [execute_command for '${cmdText}']${timeSuffix}\n\`\`\`\n${outputContent}\n\`\`\``;

              resolver(resultMsg);
              pendingToolResolvers.current.delete(message.actionId);
            }
          }
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
          extensionService.postMessage({
            command: "readFile",
            path: action.params.path,
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
                  `[read_file for '${action.params.path}'] Result: Error - ${readableError}`,
                );
              } else {
                let result = `[read_file for '${action.params.path}'] Result:\n\`\`\`\n${msg.content}\n\`\`\``;
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
          extensionService.postMessage({
            command: "writeFile",
            path: action.params.path,
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
                  `[write_to_file for '${action.params.path}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[write_to_file for '${action.params.path}'] Success: File written successfully`;
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
          extensionService.postMessage({
            command: "replaceInFile",
            path: action.params.path,
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
                  `[replace_in_file for '${action.params.path}'] Result: Error - ${msg.error}`,
                );
              } else {
                let result = `[replace_in_file for '${action.params.path}'] Success: Diff applied successfully`;
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                  result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
                  if (msg.content) {
                    result += `\n\n<current_file_content_post_edit>\n(The following is the full content of '${action.params.path}' AFTER the edit. Please review it to fix the diagnostics.)\n\`\`\`\n${msg.content}\n\`\`\`\n</current_file_content_post_edit>`;
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
          extensionService.postMessage({
            command: "listFiles",
            path: action.params.path,
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
              if (msg.error) {
                resolve(
                  `[list_files for '${action.params.path}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[list_files for '${action.params.path}'] Result:\n\`\`\`\n${msg.files}\n\`\`\``,
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
          extensionService.postMessage({
            command: "searchFiles",
            path: action.params.path,
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
                  `[search_files for '${action.params.path}'] Result: Error - ${msg.error}`,
                );
              } else {
                resolve(
                  `[search_files for '${action.params.path}'] Result:\n\`\`\`\n${msg.results}\n\`\`\``,
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
        case "execute_command": {
          commandStartTimes.current.set((action as any).actionId, Date.now());
          extensionService.postMessage({
            command: "executeCommand",
            commandText: action.params.command,
            terminalId: action.params.terminal_id, // New param
            actionId: (action as any).actionId,
          });
          pendingToolResolvers.current.set((action as any).actionId, resolve);
          break;
        }
        case "list_terminals": {
          const requestId = `list-terms-${Date.now()}`;
          extensionService.postMessage({ command: "listTerminals", requestId });
          const listener = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "listTerminalsResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", listener);
              if (msg.error) resolve(`[list_terminals] Error: ${msg.error}`);
              else
                resolve(
                  `[list_terminals] Result:\n\`\`\`json\n${JSON.stringify(msg.terminals, null, 2)}\n\`\`\``,
                );
            }
          };
          window.addEventListener("message", listener);
          break;
        }
        case "close_terminal":
        case "focus_terminal":
        case "send_interrupt":
        case "send_terminal_input":
        case "open_interactive_terminal":
        case "get_terminal_output": {
          const commandMap: Record<string, string> = {
            close_terminal: "closeTerminal",
            focus_terminal: "focusTerminal",
            send_interrupt: "sendInterrupt",
            send_terminal_input: "sendTerminalInput",
            open_interactive_terminal: "openInteractiveTerminal",
            get_terminal_output: "getTerminalOutput",
          };
          const requestId = `${action.type}-${Date.now()}`;
          extensionService.postMessage({
            command: commandMap[action.type],
            terminalId: action.params.terminal_id,
            text: action.params.text,
            requestId,
          });
          const listener = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === `${commandMap[action.type]}Result` &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", listener);
              if (msg.error) resolve(`[${action.type}] Error: ${msg.error}`);
              else if (msg.output)
                resolve(
                  `[${action.type}] Result:\n\`\`\`\n${msg.output}\n\`\`\``,
                );
              else resolve(`[${action.type}] Success`);
            }
          };
          window.addEventListener("message", listener);
          break;
        }
        case "update_codebase_context": {
          extensionService.postMessage({
            command: "getProjectContext",
            type: "save",
            context: action.params,
          });
          resolve(
            `[update_codebase_context] Success: Project context updated.`,
          );
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
    async (actionOrActions: any, message: Message) => {
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
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: { output: cleanOutput, isError },
          }));
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
          setClickedActions((prev) => new Set(prev).add(actionId));
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

        if (validResults.length < actions.length) {
          // Error case, flush immediately
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

        // Check completeness
        // We assume if we reached here, we processed all in 'actions' array.
        // But we need to check if *all* actions in the message are done?
        // The message might have more actions than what was passed here if passed partially?
        // Original code checked parsedMessagesRef to find total actions count.
        // We'll trust the user passed all relevant actions for this batch or we can query message

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
            true,
          );
        }

        return { ...prev, [message.id]: [] };
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
    clearedActions,
    handleToolRequest,
  };
};
