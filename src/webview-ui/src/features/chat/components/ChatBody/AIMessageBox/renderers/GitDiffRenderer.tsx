import React from "react";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import { ToolAction } from "@/features/chat/services/ResponseParser";

// ICONS
import { getFileIconPath } from "@/utils/fileIconMapper";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ErrorBlock from "../blocks/error/ErrorBlock";
import GitDiffBlock from "../blocks/git_diff/GitDiffBlock";

interface GitDiffRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
  onToolClick: (...args: any[]) => void;
  branch?: string;
}

const ADDED = "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
const DELETED = "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)";
const ERROR = "var(--vscode-errorForeground, #f14c4c)";

/**
 * Renderer for git_diff tool type
 */
export const GitDiffRenderer: React.FC<GitDiffRendererProps> = ({
  action,
  actionIndex,
  messageId,
  toolOutputs,
  isActiveGroup = false,
  isLastMessage = false,
  isLastItemInList = true,
  onToolClick,
  branch,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  const filePath: string = action.params.file_path || "";
  const fileName = filePath.split("/").pop() || filePath;
  const actionId = `${messageId}-action-${actionIndex}`;

  const outputData = toolOutputs?.[actionId];
  const isError = !!outputData?.isError;
  const hasOutput = !!outputData && !isError;
  const diffContent: string = isError
    ? ""
    : outputData?.output || (action.params as Record<string, any>).diff || "";

  const hasTriggeredExecution = React.useRef(false);
  React.useEffect(() => {
    if (
      !hasTriggeredExecution.current &&
      !hasOutput &&
      isActiveGroup &&
      !isLastMessage
    ) {
      hasTriggeredExecution.current = true;
      onToolClick(action, messageId, actionIndex, "accept");
    }
  }, [hasOutput, isActiveGroup, isLastMessage, actionId]);

  let added = 0;
  let deleted = 0;
  for (const line of diffContent.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    if (line.startsWith("-") && !line.startsWith("---")) deleted++;
  }

  const isPartial = !hasOutput && !isError;
  const showSkeleton = !hasOutput && !isActiveGroup;
  const visibleDiff = showSkeleton ? "" : diffContent;
  const showStats = !showSkeleton && (added > 0 || deleted > 0);

  const openFile = (path: string) => {
    if (!path) return;
    extensionService.postMessage({ command: "openFile", path });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingBottom: "4px",
        marginBottom: isLastItemInList ? "0" : "2px",
      }}
    >
      <TagHeader
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--vscode-editor-foreground)",
            }}
          >
            <span style={{ fontWeight: 600, opacity: 0.8 }}>
              {getToolLabel("git_diff")}
              {branch ? `(${branch})` : ""}
            </span>
            <img
              src={getFileIconPath(filePath)}
              alt=""
              style={{ width: "14px", height: "14px", flexShrink: 0 }}
            />
            <span
              style={{
                fontWeight: 500,
                opacity: 0.9,
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: "11px",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                openFile(filePath);
              }}
            >
              {fileName}
            </span>
            {showStats && (
              <>
                <span
                  style={{ color: ADDED, fontWeight: 600, fontSize: "11px" }}
                >
                  +{added}
                </span>
                <span
                  style={{ color: DELETED, fontWeight: 600, fontSize: "11px" }}
                >
                  -{deleted}
                </span>
              </>
            )}
            <span
              className="codicon codicon-git-pull-request"
              style={{ fontSize: "14px", marginLeft: "2px" }}
            />
          </div>
        }
        statusColor={isError ? ERROR : ADDED}
        isPartial={isPartial}
        isError={isError}
        toolType="git_diff"
        path={filePath}
        onPathClick={openFile}
        onClick={visibleDiff ? () => setIsCollapsed((v) => !v) : undefined}
      />

      {isError && outputData?.output && (
        <ErrorBlock
          content={outputData.output}
          compact={true}
          maxHeight="300px"
        />
      )}

      {!isCollapsed && visibleDiff && <GitDiffBlock diffContent={visibleDiff} />}
    </div>
  );
};