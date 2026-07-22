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
  getNextUserMessage,
  buildTreeFromPaths,
} from "../../../../utils/renderer-utils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import { TreeBlock } from "../blocks/tree/TreeBlock";
import ErrorBlock from "../blocks/error/ErrorBlock";

export const ListFilesRenderer: React.FC<BaseRendererProps> = ({
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
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  const actionId = `${messageId}-action-${actionIndex}`;
  const rawPath = action.params.folder_path || action.params.path || "";
  const displayName = rawPath ? rawPath.split("/").pop() || rawPath : "";

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

  const isPartial = false;
  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  const output = toolOutputs?.[actionId]?.output;

  let codeContent = "";
  let rawTreeData: any = null;

  // Check if we have raw JSON array (new format)
  if (Array.isArray(output)) {
    rawTreeData = output;
    codeContent = JSON.stringify(output, null, 2);
  } else {
    codeContent = typeof output === "string" ? output : "";
  }

  const isCompleted = Boolean(
    !isPartial &&
    (!!isActionClicked ||
      isError ||
      (codeContent && codeContent.trim().length > 0) ||
      !!nextUserMessage),
  );

  // Calculate file count
  let fileCount = 0;
  let folderCount = 0;
  let fileCountFromListFiles = 0;

  if (!isError) {
    if (rawTreeData && Array.isArray(rawTreeData)) {
      const countNodes = (nodes: any[]): { files: number; folders: number } => {
        let files = 0;
        let folders = 0;
        for (const node of nodes) {
          if (node.type === "file") {
            files++;
          } else if (node.type === "folder" || node.type === "directory") {
            folders++;
            if (node.children && Array.isArray(node.children)) {
              const childCounts = countNodes(node.children);
              files += childCounts.files;
              folders += childCounts.folders;
            }
          }
        }
        return { files, folders };
      };

      const counts = countNodes(rawTreeData);
      fileCountFromListFiles = counts.files;
      folderCount = counts.folders;
      fileCount = fileCountFromListFiles + folderCount;
    } else if (codeContent) {
      const lines = codeContent.split("\n").filter((line) => line.trim());

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.endsWith("/")) {
          folderCount++;
        } else if (trimmed && !trimmed.startsWith("//")) {
          fileCountFromListFiles++;
        }
      });
      fileCount = fileCountFromListFiles + folderCount;
    }
  }

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
            }}
          >
            <span
              style={{
                fontWeight: 600,
                opacity: 0.8,
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (rawPath) {
                  extensionService.postMessage({
                    command: "openFile",
                    path: rawPath,
                  });
                }
              }}
            >
              {getToolLabel("list_files")}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (rawPath) {
                  extensionService.postMessage({
                    command: "openFile",
                    path: rawPath,
                  });
                }
              }}
              style={{ display: "flex", alignItems: "center" }}
            >
              <FileIcon
                path={rawPath}
                isFolder={true}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
            </span>
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
                if (rawPath) {
                  extensionService.postMessage({
                    command: "openFile",
                    path: rawPath,
                  });
                }
              }}
            >
              {displayName || (isPartial && !rawPath ? "..." : "")}
            </span>
            {isCompleted &&
              !isError &&
              (() => {
                const depth = action.params.depth;

                if (fileCount === 0) return null;

                const parts = [];

                if (depth !== undefined && depth !== null) {
                  parts.push(`depth: ${depth}`);
                }

                parts.push(
                  `${folderCount} ${folderCount === 1 ? "folder" : "folders"}`,
                );

                parts.push(
                  `${fileCountFromListFiles} ${fileCountFromListFiles === 1 ? "file" : "files"}`,
                );

                return (
                  <span
                    style={{
                      opacity: 0.5,
                      fontSize: "10px",
                      color: "var(--vscode-descriptionForeground)",
                    }}
                  >
                    {parts.join(" • ")}
                  </span>
                );
              })()}
            {isPartial && (
              <span
                style={{
                  fontSize: "10px",
                  opacity: 0.6,
                  fontStyle: "italic",
                  marginLeft: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  className="codicon codicon-loading codicon-modifier-spin"
                  style={{ fontSize: "10px" }}
                />
              </span>
            )}
          </div>
        }
        statusColor={
          isError
            ? "var(--vscode-errorForeground)"
            : isCompleted
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : isActiveGroup
                ? "var(--vscode-descriptionForeground)"
                : "var(--vscode-descriptionForeground)"
        }
        isError={isError}
        isWaitingApproval={!!isActiveGroup && !isCompleted}
        toolType="list_files"
        tooltipMeta={{
          fileCount: fileCount || undefined,
        }}
        isPartial={isPartial}
        onClick={() => setIsCollapsed((v) => !v)}
        path={rawPath}
        onPathClick={(clickedPath) => {
          extensionService.postMessage({
            command: "openFile",
            path: clickedPath,
          });
        }}
      />

      {isError && errorMessage && (
        <ErrorBlock content={errorMessage} compact={true} maxHeight="300px" />
      )}

      {codeContent &&
        !isError &&
        !isCollapsed &&
        (() => {
          const isEmpty = codeContent.includes(
            "is empty (no files or folders inside)",
          );

          if (isEmpty) {
            return (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px 12px",
                  backgroundColor:
                    "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                  border:
                    "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
                  borderRadius: "4px",
                  fontSize: "11px",
                  color: "var(--vscode-descriptionForeground)",
                  fontStyle: "italic",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span
                  className="codicon codicon-info"
                  style={{ fontSize: "12px" }}
                />
                <span>
                  The folder{" "}
                  <code
                    style={{
                      padding: "1px 4px",
                      backgroundColor: "var(--vscode-textCodeBlock-background)",
                      borderRadius: "2px",
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                    }}
                  >
                    {rawPath}
                  </code>{" "}
                  is empty (no files or folders inside).
                </span>
              </div>
            );
          }

          if (rawTreeData && Array.isArray(rawTreeData)) {
            return (
              <TreeBlock
                files={rawTreeData}
                onFileClick={(fullPath) =>
                  extensionService.postMessage({
                    command: "openFile",
                    path: fullPath,
                  })
                }
              />
            );
          }

          const lines = codeContent.split("\n").filter(Boolean);
          const filePaths = lines
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("//"));

          const treeData = buildTreeFromPaths(filePaths);

          return (
            <TreeBlock
              files={treeData}
              onFileClick={(fullPath) =>
                extensionService.postMessage({
                  command: "openFile",
                  path: fullPath,
                })
              }
            />
          );
        })()}
    </div>
  );
};
