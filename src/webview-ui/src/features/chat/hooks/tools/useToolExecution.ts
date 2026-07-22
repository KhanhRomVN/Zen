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
export { getPermissionDecision } from "../../utils/permissionUtils";
import { getPermissionDecision } from "../../utils/permissionUtils";
import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import {
  getToolTimeout,
  TOOL_ACTION_TYPES,
  EXECUTION_STATUS,
  TERMINAL_STATUS,
} from "../../constants/constants";
import type { PermissionMode } from "../../types/tag-types";
import { getExecutor } from "../../services/tool-executors";
import type {
  ExecutorContext,
  ExecutorOptions,
} from "../../types/executor-types";

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
  const permissionModeRef = useRef<PermissionMode>(permissionMode);

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
    Record<string, (typeof TERMINAL_STATUS)[keyof typeof TERMINAL_STATUS]>
  >({});

  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  const [rejectedActions, setRejectedActions] = useState<Set<string>>(
    new Set(),
  );

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
  const earlyCommandResults = useRef<Map<string, any>>(new Map());
  const handleSendMessageRef = useRef(sendMessage);

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
          [message.terminalId]:
            message.status as (typeof TERMINAL_STATUS)[keyof typeof TERMINAL_STATUS],
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
          setTerminalStatus((prev) => ({
            ...prev,
            [message.terminalId]: TERMINAL_STATUS.BUSY,
          }));
        }
      } else if (message.command === "gitStatusResult") {
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

  // Build executor context
  const buildExecutorContext = useCallback((): ExecutorContext => {
    return {
      setToolOutputs,
      conversationIdRef,
      getToolTimeout,
      extensionService,
      messageDispatcher,
      // Extended fields for run_command and other special executors
      pendingToolResolvers: pendingToolResolvers.current,
      commandStartTimes: commandStartTimes.current,
      earlyCommandResults: earlyCommandResults.current,
    };
  }, [setToolOutputs, conversationIdRef]);

  const executeSingleAction = useCallback(
    async (
      action: any,
      skipDiagnostics: boolean = false,
      bypassIgnore: boolean = false,
    ): Promise<string | null> => {
      const context = buildExecutorContext();
      const options: ExecutorOptions = { skipDiagnostics, bypassIgnore };

      // Special handling for git_status and commit_message (display-only)
      if (action.type === "git_status" || action.type === "commit_message") {
        return "__DISPLAY_ONLY__";
      }

      const executor = getExecutor(
        action.type,
        pendingToolResolvers.current,
        commandStartTimes.current,
        earlyCommandResults.current,
      );

      if (!executor) {
        console.warn(`[Zen][tool] No executor for type: "${action.type}"`);
        return null;
      }

      return await executor.execute(action, context, options);
    },
    [buildExecutorContext],
  );

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

        const isReject = actionType === TOOL_ACTION_TYPES.REJECT;
        const isAlreadyClicked = clickedActionsRef.current.has(actionId);
        if (!isReject && isAlreadyClicked) {
          skippedCount++;
          continue;
        }

        clickedActionsRef.current.add(actionId);
        setClickedActions(new Set(clickedActionsRef.current));

        const skipDiagnostics = false;

        // SINGLE-LINE REVIEW CHECK: Detect write_to_file with content on a single line > 100 chars
        if (action.type === "write_to_file") {
          const content = action.params.content || "";
          const isSingleLine = !content.includes("\n") && content.length > 100;
          if (isSingleLine) {
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
            clickedActionsRef.current.delete(actionId);
            setClickedActions(new Set(clickedActionsRef.current));
            break;
          }
        }

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
          const isDisplayOnly = result === "__DISPLAY_ONLY__";

          if (!isDisplayOnly) {
            validResults.push(result);
          }

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
                    diagnostics: existing?.diagnostics,
                  },
                };
              });
            }

            const finalTerminalId = (action as any).params?.terminal_id;
            if (finalTerminalId) {
              terminalToActionMap.current.set(finalTerminalId, actionId);
            }
            setExecutionState((prev) => ({
              ...prev,
              completed: prev.completed + 1,
            }));

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
          setExecutionState((prev) => ({
            ...prev,
            status: EXECUTION_STATUS.ERROR,
          }));
          break;
        }
      }

      const allActionsPreSkipped = skippedCount === actions.length;
      if (allActionsPreSkipped) {
        setExecutionState((prev) =>
          prev.status === EXECUTION_STATUS.ERROR
            ? prev
            : { ...prev, status: EXECUTION_STATUS.DONE },
        );
        return;
      }

      setExecutionState((prev) =>
        prev.status === "error" ? prev : { ...prev, status: "done" },
      );

      setAvailableToolResultsBuffer((prev) => {
        const newBuffer = [...(prev[message.id] || []), ...validResults];

        if (wasInterruptedByManual) {
          return { ...prev, [message.id]: newBuffer };
        }

        if (validResults.length < actions.length) {
          const textActionIds = actions.map(
            (a) => `${message.id}-action-${a._index}`,
          );

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
    },
    [executeSingleAction],
  );

  const confirmSingleLineAction = useCallback(
    async (actionId: string) => {
      const reviewEntry = singleLineReviewActions[actionId];
      if (!reviewEntry) return;

      const { action, messageObj } = reviewEntry;

      setSingleLineReviewActions((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });

      clickedActionsRef.current.add(actionId);
      setClickedActions(new Set(clickedActionsRef.current));

      const skipDiagnostics = false;
      const result = await executeSingleAction(action, skipDiagnostics, true);

      if (result !== null) {
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

        setAvailableToolResultsBuffer((prev) => {
          const newBuffer = [...(prev[messageObj.id] || []), result];

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
    [singleLineReviewActions, executeSingleAction, messagesRef],
  );

  const rejectSingleLineAction = useCallback(
    (actionId: string) => {
      const reviewEntry = singleLineReviewActions[actionId];
      if (!reviewEntry) return;

      const { action, messageObj } = reviewEntry;

      setSingleLineReviewActions((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });

      setRejectedActions((prev) => new Set(prev).add(actionId));
      window.postMessage({ command: "markActionRejected", actionId }, "*");

      const filePath =
        action.params.file_path || action.params.path || "unknown";
      const errorResult = `[write_to_file for '${filePath}'] Result: Error - Nội dung file bị dồn vào 1 dòng duy nhất (${action.params.content?.length || 0} ký tự). Vui lòng chia lại thành nhiều dòng với ngắt dòng (\\n) thực sự trước khi thực hiện write_to_file.`;

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
              clickedActionsRef.current.has(id) || id === actionId,
          ) && isQuestionAnswered;

        if (isAllComplete && !flushedMessageIdsRef.current.has(messageObj.id)) {
          if (handleSendMessageRef.current && !isStoppedRef?.current) {
            flushedMessageIdsRef.current.add(messageObj.id);
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

  const autoFlushCountRef = useRef(0);
  useEffect(() => {
    const bufferKeys = Object.keys(availableToolResultsBuffer);
    const hasBuffer = bufferKeys.some(
      (key) => availableToolResultsBuffer[key].length > 0,
    );

    if (!hasBuffer) {
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
          if (handleSendMessageRef.current && !isStoppedRef?.current) {
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
