import React, { useState, useEffect } from "react";

// HOOKS
import { useProject } from "../../../../../context/ProjectContext";

// SERVICES
import { extensionService } from "../../../../../services/ExtensionService";

// CONSTANTS
import {
  shouldShowFileStats,
  shouldValidateFuzzyMatch,
  isToolClickable,
  TOOL_ACTION_TYPES,
  EXECUTION_STATUS,
  TERMINAL_STATUS,
  type TerminalStatus,
  TAG_REGISTRY,
} from "../../../constants/constants";

// TYPES
import { ToolAction } from "../../../services/ResponseParser";
import { Message } from "../../../types/message";
import { GroupType } from "../../../types/renderer-types";

// UTILS
import { formatActionForDisplay } from "../../../services/ResponseParser";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import {
  CommitMessageRenderer, // commit_message
  DeleteFileRenderer, // delete_file
  ErrorRenderer, // error (not tag)
  WriteToFileRenderer, // write_to_file
  ReplaceInFileRenderer, // replace_in_file
  ReadFileRenderer, // read_file
  ListFilesRenderer, // list_file
  FindFilesRenderer, // find_files
  GrepRenderer, // grep
  MoveFileRenderer, // move_file
  RevertFileRenderer, // revert_file
  ViewReplaceHistoryRenderer, // view_replace_history
  RunCommandRenderer, // run_command
  GitStatusRenderer, // git_status
  MarkdownRenderer, // markdown
  QuestionRenderer, // question
  WarningRenderer, // warning (not tag)
  ThinkingRenderer, // thinking
} from "./renderers";
import { GitDiffBlock } from "./blocks/git_diff/GitDiffBlock";
import ErrorBlock from "./blocks/error/ErrorBlock";

interface TagRouterProps {
  group: GroupType;
  messageId: string;
  clickedActions: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    actionIndex: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  isActiveGroup?: boolean;
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  isLastGroup?: boolean;
  toolOutputs?: Record<
    string,
    { output: string; isError: boolean; terminalId?: string }
  >;
  terminalStatus?: Record<string, TerminalStatus>;
  nextUserMessage?: Message;
  allMessages?: Message[];
  allActions?: ToolAction[];
  conversationId?: string;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  onGitConfirm?: (statusItems: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
  knownFilePaths?: Map<string, string>;
  isGenerating?: boolean;
  onSelectOption?: (messageId: string, option: string) => void;
  onSendMessage?: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
  ) => void;
  isBlockedByPrecedingInteraction?: boolean;
}

const TagRouterInternal: React.FC<TagRouterProps> = ({
  group,
  messageId,
  clickedActions,
  rejectedActions,
  onToolClick,
  executionState,
  isActiveGroup,
  failedActions,
  isLastMessage,
  isLastGroup = true,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  allActions,
  conversationId,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
  onGitConfirm,
  onGitCancel,
  gitStatusItems,
  gitStatusBranch,
  isGitProcessing,
  isGitStatusVisible = true,
  onBackToHome,
  knownFilePaths,
  isGenerating,
  onSelectOption,
  onSendMessage,
  isBlockedByPrecedingInteraction = false,
}) => {
  const { rootPath } = useProject();

  // Handle UI blocks (markdown, question, error, warning)
  if (group.type === "markdown") {
    return (
      <MarkdownRenderer
        content={group.content}
        knownFilePaths={knownFilePaths}
      />
    );
  }

  if (group.type === "question") {
    const hasQuestions = group.questions && group.questions.length > 0;
    return (
      <QuestionRenderer
        questions={hasQuestions ? group.questions : undefined}
        options={!hasQuestions ? group.options : undefined}
        title={group.title}
        optional={group.optional}
        selectedOption={group.selectedOption}
        questionAnswers={group.questionAnswers}
        disabled={!!nextUserMessage || isGenerating}
        onAnswer={(questionId, value) => {
          if (!hasQuestions) return;
          if (onSelectOption) {
            onSelectOption(messageId, JSON.stringify({ questionId, value }));
          }
        }}
        onAllAnswered={(answers) => {
          if (!hasQuestions) return;
          if (onSelectOption) {
            onSelectOption(
              messageId,
              JSON.stringify({
                allAnswered: true,
                answers,
                questions: group.questions || [],
              }),
            );
          }
        }}
        onOptionSelect={(option: string) => {
          if (hasQuestions) return;
          if (onSelectOption) {
            onSelectOption(messageId, option);
          }
          if (onSendMessage) {
            onSendMessage(
              `[question: "${group.title || "Question"}"] Answer: ${option}`,
              undefined,
              undefined,
              undefined,
              true,
            );
          }
        }}
      />
    );
  }

  if (group.type === "error") {
    return (
      <ErrorRenderer
        content={group.content}
        errorCode={group.errorCode}
        toolName={group.toolName}
        isLast={isLastGroup}
        isLastMessage={isLastMessage}
        maxHeight="300px"
      />
    );
  }

  if (group.type === "warning") {
    return (
      <WarningRenderer
        label={group.label}
        message={group.message}
        warningColor="var(--vscode-editorWarning-foreground, #cca700)"
        isPulsing={false}
      />
    );
  }

  if (group.type === "thinking") {
    return <ThinkingRenderer content={group.content} />;
  }

  // Handle tools group - rest of the original logic
  if (group.type !== "tools") {
    return null;
  }

  const toolGroup = group.items;

  const [fuzzyStatus, setFuzzyStatus] = React.useState<{
    status: string;
    score?: number;
    startLine?: number;
  } | null>(null);
  const [fileStatsMap, setFileStatsMap] = React.useState<
    Record<string, { lines: number; loading: boolean }>
  >({});
  const [isPreviewing, setIsPreviewing] = React.useState<string | null>(null);
  const [storedOutput, setStoredOutput] = useState<string | null>(null);
  const [collapsedActions, setCollapsedActions] = useState<Set<string>>(
    new Set(),
  );
  const processedActions = React.useRef<Set<string>>(new Set());

  const toggleCollapse = (actionId: string) => {
    setCollapsedActions((prev) => {
      const next = new Set(prev);
      next.has(actionId) ? next.delete(actionId) : next.add(actionId);
      return next;
    });
  };

  const effectCollapsedCountRef = React.useRef(0);
  useEffect(() => {
    effectCollapsedCountRef.current += 1;
    const initialCollapsed = new Set<string>();
    toolGroup.forEach((item, index) => {
      const actionId = `${messageId}-action-${index}`;
      if (item.action.type !== "run_command") {
        initialCollapsed.add(actionId);
      }
    });
    setCollapsedActions(initialCollapsed);
  }, [toolGroup, messageId]);

  // Fetch terminal output from history
  const runCommandAction = toolGroup.find(
    (g) => g.action.type === "run_command",
  );
  useEffect(() => {
    if (!nextUserMessage?.content || !runCommandAction) return;
    const commandText = runCommandAction.action.params.command;
    if (!commandText) return;

    const escaped = commandText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `Output: \\[run_command for '${escaped}'.*?\\] .*?with "terminal_output-([a-f0-9-]+)"`,
    ).exec(nextUserMessage.content);

    if (match?.[1]) {
      const outputUuid = match[1];
      const requestId = `read-terminal-${outputUuid}`;
      if (processedActions.current.has(requestId) || storedOutput) return;

      const handleMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (
          msg.command === "readTerminalOutputResult" &&
          msg.outputUuid === outputUuid
        ) {
          if (msg.content) setStoredOutput(msg.content);
          window.removeEventListener("message", handleMessage);
        }
      };
      window.addEventListener("message", handleMessage);
      processedActions.current.add(requestId);
      extensionService.postMessage({
        command: "readTerminalOutput",
        chatUuid: conversationId || nextUserMessage.conversationId || "",
        outputUuid,
        requestId,
      });
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [
    nextUserMessage?.id,
    runCommandAction?.action.params.command,
    messageId,
    storedOutput,
  ]);

  // Validate fuzzy match & fetch file stats
  React.useEffect(() => {
    const _effectStartTime = performance.now();
    const cleanups: (() => void)[] = [];

    toolGroup.forEach((item) => {
      const { action, index } = item;
      const actionId = `${messageId}-action-${index}`;

      // Check if tool needs fuzzy match validation
      if (shouldValidateFuzzyMatch(action.type) && action.params.diff) {
        const validationId = `${messageId}-${index}-validate`;
        if (processedActions.current.has(validationId)) return;

        const handleMessage = (event: MessageEvent) => {
          const msg = event.data;
          if (
            msg.command === "validateFuzzyMatchResult" &&
            msg.id === validationId
          ) {
            setFuzzyStatus({
              status: msg.status,
              score: msg.score,
              startLine: msg.startLine,
            });
            window.removeEventListener("message", handleMessage);
          }
        };
        window.addEventListener("message", handleMessage);
        cleanups.push(() =>
          window.removeEventListener("message", handleMessage),
        );
        processedActions.current.add(validationId);
        (window as any).vscodeApi?.postMessage({
          command: "validateFuzzyMatch",
          path: action.params.path,
          diff: action.params.diff,
          id: validationId,
        });
      }

      // Check if tool needs file stats
      if (
        shouldShowFileStats(action.type) &&
        (action.params.path || action.params.file_path)
      ) {
        const path = action.params.path || action.params.file_path;
        if (fileStatsMap[path]) return;
        const statId = `${messageId}-${index}-stats`;
        if (processedActions.current.has(statId)) return;
        processedActions.current.add(statId);

        const handleStats = (event: MessageEvent) => {
          const msg = event.data;
          if (
            msg.command === "fileStatsResult" &&
            msg.id === statId &&
            msg.path === path
          ) {
            setFileStatsMap((prev) => ({
              ...prev,
              [path]: { lines: msg.lines, loading: false },
            }));
            window.removeEventListener("message", handleStats);
          }
        };
        window.addEventListener("message", handleStats);
        cleanups.push(() => window.removeEventListener("message", handleStats));
        (window as any).vscodeApi?.postMessage({
          command: "getFileStats",
          path,
          id: statId,
        });
      }
    });

    return () => cleanups.forEach((c) => c());
  }, [
    toolGroup,
    messageId,
    isActiveGroup,
    clickedActions,
    onToolClick,
    fileStatsMap,
  ]);

  if (!toolGroup || toolGroup.length === 0) return null;

  const firstAction = toolGroup[0].action;
  const toolType = firstAction.type;
  const isLastItemInList = isLastGroup;

  // Handle malformed/error tool actions - show custom header + ErrorBlock
  if (firstAction.isError) {
    const errorColor = "var(--vscode-errorForeground, #f44336)";

    // Determine label based on tool type from TAG_REGISTRY
    const toolLabel =
      TAG_REGISTRY[toolType]?.title ??
      toolType.toUpperCase().replace(/_/g, " ");

    // Extract file path or relevant info from params
    const filePath =
      firstAction.params.file_path ||
      firstAction.params.folder_path ||
      firstAction.params.path ||
      "";
    const fileName = filePath ? filePath.split("/").pop() || filePath : "";

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          marginBottom: isLastItemInList ? "0" : "8px",
        }}
      >
        <div
          className="terminal-block-header"
          style={{
            paddingTop: "4px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div className="terminal-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="terminal-header-top">
              <div
                style={{
                  marginTop: "1px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    flexWrap: "nowrap",
                  }}
                >
                  {/* Status dot */}
                  <div
                    style={{
                      position: "relative",
                      width: "16px",
                      height: "16px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: "2px",
                    }}
                    title="Error - Action failed"
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: `2px solid ${errorColor}`,
                        opacity: 0.4,
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: errorColor,
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      marginTop: "2px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        className="terminal-name"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          color: "var(--vscode-editor-foreground)",
                        }}
                      >
                        <span style={{ fontWeight: 600, opacity: 0.8 }}>
                          {toolLabel}
                        </span>
                        {fileName && (
                          <>
                            <span
                              style={{ display: "flex", alignItems: "center" }}
                            >
                              <FileIcon
                                path={filePath}
                                style={{ width: "16px", height: "16px" }}
                              />
                            </span>
                            <span
                              style={{
                                fontWeight: 500,
                                opacity: 0.9,
                                fontFamily:
                                  "var(--vscode-editor-font-family, monospace)",
                                fontSize: "11px",
                              }}
                            >
                              {fileName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {filePath && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          paddingRight: "4px",
                          paddingTop: "4px",
                          marginTop: "2px",
                          position: "relative",
                          width: "100%",
                          maxWidth: "100%",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: "0",
                            top: "0",
                            width: "16px",
                            height: "12px",
                            borderLeft:
                              "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent)",
                            borderBottom:
                              "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent)",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "10px",
                            opacity: 0.6,
                            color: "var(--vscode-descriptionForeground)",
                            fontFamily:
                              "var(--vscode-editor-font-family, monospace)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            width: "100%",
                            padding: "0 4px 0 20px",
                            borderRadius: "2px",
                          }}
                          title={filePath}
                        >
                          {filePath}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ErrorBlock
          content={firstAction.errorMessage || "Unknown error occurred"}
          errorCode={firstAction.errorCode}
          showHeader={false}
          maxHeight="300px"
        />
      </div>
    );
  }

  // Handle view_replace_history BEFORE isFileTool check
  if (toolType === "view_replace_history") {
    const action = firstAction;
    const actionIndex = toolGroup[0].index;
    return (
      <ViewReplaceHistoryRenderer
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
      />
    );
  }

  if (toolType === "write_to_file") {
    const action = firstAction;
    const actionIndex = toolGroup[0].index;
    return (
      <WriteToFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
        singleLineReviewActions={singleLineReviewActions}
        onConfirmSingleLineAction={onConfirmSingleLineAction}
        onRejectSingleLineAction={onRejectSingleLineAction}
      />
    );
  }

  if (toolType === "replace_in_file") {
    const action = firstAction;
    const actionIndex = toolGroup[0].index;
    return (
      <ReplaceInFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${actionIndex}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
        mergedItems={toolGroup}
      />
    );
  }

  if (toolType === "run_command") {
    return (
      <RunCommandRenderer
        action={firstAction}
        actionIndex={toolGroup[0].index}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${toolGroup[0].index}`,
        )}
        isRejected={rejectedActions?.has(
          `${messageId}-action-${toolGroup[0].index}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        nextUserMessage={nextUserMessage}
        rootPath={rootPath}
        onToolClick={onToolClick}
        storedOutput={storedOutput}
      />
    );
  }

  if (toolType === "git_status") {
    // Use props gitStatusItems if available, otherwise parse from action params
    let finalGitStatusItems = gitStatusItems;
    if (!finalGitStatusItems || finalGitStatusItems.length === 0) {
      let itemsFromParams = firstAction.params?.items || [];
      if (typeof itemsFromParams === "string") {
        try {
          itemsFromParams = JSON.parse(itemsFromParams);
        } catch (e) {
          itemsFromParams = [];
        }
      }
      finalGitStatusItems = itemsFromParams;
    }
    return (
      <GitStatusRenderer
        action={firstAction}
        actionIndex={toolGroup[0].index}
        messageId={messageId}
        isActionClicked={clickedActions.has(
          `${messageId}-action-${toolGroup[0].index}`,
        )}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        onToolClick={onToolClick}
        gitStatusItems={finalGitStatusItems}
        branch={gitStatusBranch}
        isProcessing={isGitProcessing || executionState?.status === "running"}
        onConfirm={onGitConfirm}
        onCancel={onGitCancel}
        isVisible={isGitStatusVisible}
      />
    );
  }

  if (toolType === "commit_message") {
    const action = firstAction;
    const actionIndex = toolGroup[0].index;
    const actionId = `${messageId}-action-${actionIndex}`;
    const isRejected = rejectedActions?.has(actionId) || false;

    return (
      <CommitMessageRenderer
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(actionId)}
        isRejected={isRejected}
        isLastItemInList={isLastItemInList}
        onToolClick={onToolClick}
        branch={gitStatusBranch}
      />
    );
  }

  if (toolType === "git_diff") {
    const filePath = firstAction.params.file_path || "";
    const actionIndex = toolGroup[0].index;
    const actionId = `${messageId}-action-${actionIndex}`;

    // Check if we already have the diff result in toolOutputs
    const outputData = toolOutputs?.[actionId];
    const diffContent = outputData?.output || firstAction.params.diff || "";
    const hasOutput = !!outputData && !outputData.isError;

    // Auto-execute the tool if not yet executed and it's the active group
    const hasTriggeredExecution = React.useRef(false);
    React.useEffect(() => {
      if (
        !hasTriggeredExecution.current &&
        !hasOutput &&
        isActiveGroup &&
        !isLastMessage
      ) {
        hasTriggeredExecution.current = true;
        onToolClick(firstAction, messageId, actionIndex, "accept");
      }
    }, [hasOutput, isActiveGroup, isLastMessage, actionId]);

    // Parse diff stats from the diff content
    const parseDiffStats = (content: string) => {
      let added = 0;
      let deleted = 0;
      if (!content) return { added: 0, deleted: 0 };
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) added++;
        if (line.startsWith("-") && !line.startsWith("---")) deleted++;
      }
      return { added, deleted };
    };

    const stats = parseDiffStats(diffContent);

    // If no output yet and we're not the active group, show a loading/skeleton state
    if (!hasOutput && !isActiveGroup) {
      return (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <GitDiffBlock
            filePath={filePath}
            diffContent=""
            added={0}
            deleted={0}
            statusColor="var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
            isPartial={true}
            branch={gitStatusBranch}
            onFileClick={(path: any) => {
              const vscodeApi = (window as any).vscodeApi;
              if (vscodeApi) {
                vscodeApi.postMessage({
                  command: "openFile",
                  path,
                });
              }
            }}
          />
        </div>
      );
    }

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <GitDiffBlock
          filePath={filePath}
          diffContent={diffContent}
          added={stats.added}
          deleted={stats.deleted}
          statusColor="var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
          isPartial={!hasOutput && isActiveGroup}
          branch={gitStatusBranch}
          onFileClick={(path: any) => {
            const vscodeApi = (window as any).vscodeApi;
            if (vscodeApi) {
              vscodeApi.postMessage({
                command: "openFile",
                path,
              });
            }
          }}
        />
      </div>
    );
  }

  // Handle read_file tool type
  if (toolType === "read_file") {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <ReadFileRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(`${messageId}-action-${index}`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
          />
        ))}
      </>
    );
  }

  // Handle list_files tool type
  if (toolType === "list_files") {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <ListFilesRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(`${messageId}-action-${index}`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
          />
        ))}
      </>
    );
  }

  // Handle find_files tool type
  if (toolType === "find_files") {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <FindFilesRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(`${messageId}-action-${index}`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
          />
        ))}
      </>
    );
  }

  // Handle grep tool type
  if (toolType === "grep") {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <GrepRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(`${messageId}-action-${index}`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
          />
        ))}
      </>
    );
  }

  // Handle delete_file tool type
  if (toolType === "delete_file") {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <DeleteFileRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(`${messageId}-action-${index}`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
          />
        ))}
      </>
    );
  }

  // Handle move_file tool type
  if (toolType === "move_file") {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <MoveFileRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(`${messageId}-action-${index}`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
          />
        ))}
      </>
    );
  }

  // Handle revert_file tool type
  if (toolType === "revert_file") {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <RevertFileRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(`${messageId}-action-${index}`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
          />
        ))}
      </>
    );
  }

  // Fallback for non-styled tools
  return (
    <>
      {toolGroup.map(({ action, index }) => (
        <div key={index} style={{ marginBottom: "8px" }}>
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              border: "2px solid var(--vscode-descriptionForeground, #6b7280)",
              borderRadius: "var(--border-radius-lg)",
              cursor: isToolClickable(action.type) ? "pointer" : "default",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              width: "fit-content",
            }}
            onClick={() => {
              if (isToolClickable(action.type))
                onToolClick(action, messageId, index, "accept");
            }}
          >
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
                fontWeight: 600,
                flex: 1,
              }}
            >
              {formatActionForDisplay(action)}
            </span>
            {isToolClickable(action.type) && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--vscode-descriptionForeground, #6b7280)"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </>
  );
};

// ============================================
// ToolActionsList Component (from ToolAction.tsx)
// ============================================

interface ToolActionsListProps {
  message: Message;
  items: { action: ToolAction; index: number }[];
  clickedActions: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: ToolAction | ToolAction[],
    message: Message,
    actionIndex: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  isVisibleTool?: (type: string) => boolean;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, TerminalStatus>;
  nextUserMessage?: Message;
  allMessages?: Message[];
  conversationId?: string;
  allActions?: ToolAction[];
  isBlockedByPrecedingInteraction?: boolean;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  onGitConfirm?: (items: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
}

const ToolActionsList: React.FC<ToolActionsListProps> = ({
  message,
  items,
  clickedActions,
  rejectedActions,
  onToolClick,
  executionState,
  failedActions,
  isLastMessage,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  conversationId,
  allActions,
  isBlockedByPrecedingInteraction = false,
  isVisibleTool = (type: string) => true,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
  onGitConfirm,
  onGitCancel,
  gitStatusItems,
  gitStatusBranch,
  isGitProcessing,
  isGitStatusVisible = true,
  onBackToHome,
}) => {
  // Filter out invisible tools immediately
  const visibleItems = React.useMemo(() => {
    return items.filter((item) => isVisibleTool(item.action.type));
  }, [items, isVisibleTool]);

  // Memoize action handlers to prevent unnecessary re-renders
  const memoizedActions = React.useMemo(() => {
    const MERGE_TYPES = new Set(["write_to_file", "replace_in_file"]);
    const getPath = (action: ToolAction) =>
      action.params.file_path || action.params.path || "";

    const groups: { action: ToolAction; index: number }[][] = [];
    visibleItems.forEach((item) => {
      const last = groups[groups.length - 1];
      if (
        last &&
        MERGE_TYPES.has(item.action.type) &&
        MERGE_TYPES.has(last[0].action.type) &&
        getPath(item.action) === getPath(last[0].action)
      ) {
        last.push(item);
      } else {
        groups.push([item]);
      }
    });

    return groups.map((group, groupIdx) => {
      const firstItem = group[0];
      const key = `group-${firstItem.index}`;

      let isPreviousAllDone = true;
      for (let i = 0; i < firstItem.index; i++) {
        const actionId = `${message.id}-action-${i}`;
        const hasOutput = toolOutputs && toolOutputs[actionId];
        const isClicked = clickedActions.has(actionId);

        // If there's a user message after this assistant message,
        // or a message in history containing the output of this action, it is completed.
        const hasHistoryOutput =
          !!nextUserMessage ||
          !!allMessages?.some((m) => m.actionIds?.includes(actionId));

        // Check if this action is completed (clicked, has output, or history output)
        const isCompleted = isClicked || hasOutput || hasHistoryOutput;

        if (!isCompleted) {
          const action = allActions ? allActions[i] : null;
          const isWriteTool =
            action &&
            (action.type === "write_to_file" ||
              action.type === "replace_in_file");

          if (isWriteTool && !hasHistoryOutput) {
            // Write/edit tool not yet approved → block subsequent tools
            isPreviousAllDone = false;
            break;
          }
          // For non-write tools (read, run_command, etc.), block as usual
          if (!isWriteTool) {
            isPreviousAllDone = false;
            break;
          }
        }

        // If it's a run_command, check if it's actually finished
        const action = allActions ? allActions[i] : null;
        if (action && action.type === "run_command") {
          const output = toolOutputs?.[actionId];
          const terminalId =
            (output as any)?.terminalId || action.params.terminal_id;
          if (
            terminalId &&
            terminalStatus?.[terminalId] === TERMINAL_STATUS.BUSY &&
            !hasHistoryOutput
          ) {
            isPreviousAllDone = false;
            break;
          }
        }
      }

      const isThisActionClicked = clickedActions.has(
        `${message.id}-action-${firstItem.index}`,
      );

      const isActiveGroup =
        isLastMessage &&
        isPreviousAllDone &&
        !isThisActionClicked &&
        !isBlockedByPrecedingInteraction;

      return (
        <React.Fragment key={key}>
          <TagRouterInternal
            group={{ type: "tools", items: group, key }}
            messageId={message.id}
            clickedActions={clickedActions}
            rejectedActions={rejectedActions}
            onToolClick={(act, msgId, aIdx, type) =>
              onToolClick(act, message, aIdx, type)
            }
            executionState={executionState}
            isActiveGroup={isActiveGroup}
            failedActions={failedActions}
            isLastMessage={isLastMessage}
            isLastGroup={groupIdx === groups.length - 1}
            toolOutputs={toolOutputs}
            terminalStatus={terminalStatus}
            nextUserMessage={nextUserMessage}
            allMessages={allMessages}
            conversationId={conversationId}
            singleLineReviewActions={singleLineReviewActions}
            onConfirmSingleLineAction={onConfirmSingleLineAction}
            onRejectSingleLineAction={onRejectSingleLineAction}
            onGitConfirm={onGitConfirm}
            onGitCancel={onGitCancel}
            gitStatusItems={gitStatusItems}
            gitStatusBranch={gitStatusBranch}
            isGitProcessing={isGitProcessing}
            isGitStatusVisible={isGitStatusVisible}
            onBackToHome={onBackToHome}
          />
        </React.Fragment>
      );
    });
  }, [
    items,
    clickedActions,
    message,
    onToolClick,
    isLastMessage,
    toolOutputs,
    terminalStatus,
    nextUserMessage,
  ]);

  if (!visibleItems || visibleItems.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {memoizedActions}
    </div>
  );
};

export default TagRouterInternal;
