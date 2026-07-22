import React from "react";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// TYPES
import { BaseRendererProps } from "@/features/chat/types/renderer-types";

// UTILS
import {
  collectConvFilePaths,
  getDisplayPath,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import GrepBlock from "../blocks/grep/GrepBlock";

export const GrepRenderer: React.FC<BaseRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isActiveGroup,
  isLastMessage,
  isLastItemInList,
  toolOutputs,
  allMessages,
  onToolClick,
  conversationId,
}) => {
  const [isGrepCollapsed, setIsGrepCollapsed] = React.useState(true);

  const actionId = `${messageId}-action-${actionIndex}`;

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

  const isPartial = false;
  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  const grepValidationError = action.params._validationError;
  const grepCompleted =
    (!isPartial || !!grepValidationError) &&
    (isActionClicked ||
      isError ||
      !!grepValidationError ||
      !!toolOutputs?.[actionId] ||
      !!nextUserMessage);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
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
              cursor: grepCompleted ? "pointer" : "default",
            }}
            onClick={
              grepCompleted ? () => setIsGrepCollapsed((v) => !v) : undefined
            }
          >
            <span style={{ fontWeight: 600, opacity: 0.8, flexShrink: 0 }}>{getToolLabel("grep")}</span>
            <span
              style={{
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--vscode-textLink-foreground)",
                padding: "0 5px",
                backgroundColor:
                  "color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent)",
                borderRadius: "3px",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flexShrink: 1,
              }}
              title={action.params.search_term || action.params.searchTerm || ""}
            >
              {action.params.search_term || action.params.searchTerm || ""}
            </span>
            {(() => {
              const folderPath =
                action.params.folder_path || action.params.folderPath || "";
              const filePath =
                action.params.file_path || action.params.filePath || "";
              const targetPath = folderPath || filePath || "";
              const isFolder = !!folderPath;
              if (!targetPath) return null;
              const segments = targetPath.split("/").filter(Boolean);
              if (segments.length === 0) return null;
              return (
                <>
                  <span style={{ opacity: 0.4, fontSize: "11px", flexShrink: 0 }}>in</span>
                  <FileIcon
                    path={targetPath}
                    isFolder={isFolder}
                    style={{ width: "14px", height: "14px", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontWeight: 500,
                      opacity: 0.8,
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                      fontSize: "11px",
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flexShrink: 1,
                    }}
                    title={targetPath}
                  >
                    {getDisplayPath(targetPath, allPaths) || "..."}
                  </span>
                </>
              );
            })()}
            {isPartial && !grepCompleted && (
              <span
                style={{
                  fontSize: "10px",
                  opacity: 0.55,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  flexShrink: 0,
                  marginLeft: "auto",
                }}
              >
                <span
                  className="codicon codicon-loading codicon-modifier-spin"
                  style={{ fontSize: "10px" }}
                />
                Searching...
              </span>
            )}
            {grepCompleted &&
              (() => {
                const output = toolOutputs?.[actionId]?.output || "";
                let totalMatches = 0;
                let fileCount = 0;
                try {
                  const match = output.match(/total_matches="(\d+)"/);
                  if (match) totalMatches = parseInt(match[1], 10);
                  const fileMatch = output.match(/files="(\d+)"/);
                  if (fileMatch) fileCount = parseInt(fileMatch[1], 10);
                } catch {}
                if (totalMatches === 0 && fileCount === 0) {
                  return (
                    <span
                      style={{
                        opacity: 0.5,
                        fontSize: "10px",
                        color: "var(--vscode-descriptionForeground)",
                        fontStyle: "italic",
                        flexShrink: 0,
                        marginLeft: "auto",
                      }}
                    >
                      no matches
                    </span>
                  );
                }
                return (
                  <span
                    style={{
                      opacity: 0.5,
                      fontSize: "10px",
                      color: "var(--vscode-descriptionForeground)",
                      flexShrink: 0,
                      marginLeft: "auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {totalMatches} {totalMatches === 1 ? "match" : "matches"} in{" "}
                    {fileCount} {fileCount === 1 ? "file" : "files"}
                  </span>
                );
              })()}
            {grepCompleted && (
              <span
                className={`codicon codicon-chevron-${isGrepCollapsed ? "right" : "down"}`}
                style={{ fontSize: "10px", opacity: 0.5, marginLeft: "2px", flexShrink: 0 }}
              />
            )}
          </div>
        }
        statusColor={
          isError
            ? "var(--vscode-errorForeground)"
            : grepCompleted
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : isActiveGroup
                ? "var(--vscode-descriptionForeground)"
                : "var(--vscode-descriptionForeground)"
        }
        isError={isError}
        isWaitingApproval={!!isActiveGroup && !grepCompleted}
        toolType="grep"
        path={(() => {
          const folderPath =
            action.params.folder_path || action.params.folderPath || "";
          const filePath =
            action.params.file_path || action.params.filePath || "";
          return folderPath || filePath || "";
        })()}
        onPathClick={(clickedPath) => {
          extensionService.postMessage({
            command: "openFile",
            path: clickedPath,
          });
        }}
        tooltipMeta={(() => {
          const meta: {
            matchCount?: number;
            fileCount?: number;
          } = {};

          if (grepCompleted) {
            const output = toolOutputs?.[actionId]?.output || "";
            try {
              const matchResult = output.match(/total_matches="(\d+)"/);
              if (matchResult) meta.matchCount = parseInt(matchResult[1], 10);
              const fileResult = output.match(/files="(\d+)"/);
              if (fileResult) meta.fileCount = parseInt(fileResult[1], 10);
            } catch {}
          }

          return meta;
        })()}
        isPartial={isPartial}
      />

      <GrepBlock
        action={action}
        actionId={actionId}
        toolOutputs={toolOutputs}
        isPartial={!!isPartial}
        isCompleted={grepCompleted}
        isError={isError}
        errorMessage={errorMessage}
        conversationId={conversationId}
        allMessages={allMessages}
        isCollapsed={isGrepCollapsed}
        onToggleCollapse={() => setIsGrepCollapsed((v) => !v)}
      />
    </div>
  );
};
