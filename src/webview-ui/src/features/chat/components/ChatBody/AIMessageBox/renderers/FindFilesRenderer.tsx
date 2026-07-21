import React from "react";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// TYPES
import { BaseRendererProps } from "@/features/chat/types/renderer-types";

// UTILS
import {
  getNextUserMessage,
  buildTreeFromPaths,
} from "../../../../utils/renderer-utils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import { TreeBlock } from "../blocks/tree/TreeBlock";
import ErrorBlock from "../blocks/error/ErrorBlock";

export const FindFilesRenderer: React.FC<BaseRendererProps> = ({
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
  const [showRawView, setShowRawView] = React.useState(false);

  const actionId = `${messageId}-action-${actionIndex}`;

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

  const isPartial = false;
  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  const output = toolOutputs?.[actionId]?.output;
  const codeContent = typeof output === "string" ? output : "";

  const isCompleted = Boolean(
    !isPartial &&
    (!!isActionClicked ||
      isError ||
      !!toolOutputs?.[actionId] ||
      !!nextUserMessage),
  );

  // Calculate file count
  let fileCount = 0;
  if (codeContent && !isError) {
    try {
      const match = codeContent.match(/Found (\d+) file\(s\)/);
      if (match) {
        fileCount = parseInt(match[1], 10);
      }
    } catch (err) {}
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
              flexDirection: "column",
              gap: "4px",
              fontSize: "12px",
              color: "var(--vscode-editor-foreground)",
              cursor: isCompleted ? "pointer" : "default",
            }}
            onClick={isCompleted ? () => setIsCollapsed((v) => !v) : undefined}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 600, opacity: 0.8 }}>FIND</span>
              {isPartial && !isCompleted && (
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.55,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    className="codicon codicon-loading codicon-modifier-spin"
                    style={{ fontSize: "10px" }}
                  />
                  Searching...
                </span>
              )}
              {isCompleted && (
                <>
                  <span
                    className={`codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}
                    style={{ fontSize: "10px", opacity: 0.5 }}
                  />
                  <span
                    style={{
                      opacity: 0.5,
                      fontSize: "10px",
                      color: "var(--vscode-descriptionForeground)",
                    }}
                  >
                    {fileCount} {fileCount === 1 ? "file" : "files"}
                  </span>
                </>
              )}
            </div>

            {(() => {
              const searchFileNames =
                action.params.file_names || action.params.file_name;
              const fileNamesArray = Array.isArray(searchFileNames)
                ? searchFileNames
                : searchFileNames
                  ? [searchFileNames]
                  : [];

              if (fileNamesArray.length > 0) {
                return (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      alignItems: "center",
                      marginLeft: "2px",
                    }}
                  >
                    {fileNamesArray.map((fileName, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {idx > 0 && (
                          <span style={{ opacity: 0.3, fontSize: "11px" }}>
                            |
                          </span>
                        )}
                        <FileIcon
                          path={fileName}
                          isFolder={false}
                          style={{ width: "14px", height: "14px" }}
                        />
                        <span
                          style={{
                            fontFamily:
                              "var(--vscode-editor-font-family, monospace)",
                            fontSize: "11px",
                            fontWeight: 500,
                            opacity: 0.9,
                          }}
                        >
                          {fileName}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
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
        toolType="find_files"
        isPartial={isPartial}
        onDotClick={() => {
          setShowRawView(!showRawView);
        }}
      />

      {showRawView && (
        <div
          style={{
            marginTop: "4px",
            padding: "8px 12px",
            backgroundColor:
              "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
            border:
              "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            borderRadius: "4px",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "var(--vscode-editor-foreground)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflowX: "auto",
          }}
        >
          {action.rawXml || JSON.stringify(action, null, 2)}
        </div>
      )}

      {isError && errorMessage && (
        <ErrorBlock content={errorMessage} compact={true} maxHeight="300px" />
      )}

      {codeContent && !isError && !isCollapsed && (
        <div style={{ marginTop: "8px" }}>
          {(() => {
            const lines = codeContent.split("\n");
            const filePaths: string[] = [];

            for (const line of lines) {
              if (line.startsWith("- ")) {
                const filePath = line.substring(2).trim();
                if (filePath) {
                  filePaths.push(filePath);
                }
              }
            }

            if (filePaths.length === 0) {
              return (
                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor:
                      "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                    border:
                      "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
                    borderRadius: "4px",
                    color: "var(--vscode-descriptionForeground)",
                    opacity: 0.7,
                    fontStyle: "italic",
                    fontSize: "11px",
                  }}
                >
                  No files found matching the search criteria.
                </div>
              );
            }

            const treeData = buildTreeFromPaths(filePaths);

            return (
              <div
                style={{
                  padding: "10px 12px",
                  backgroundColor:
                    "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                  border:
                    "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
                  borderRadius: "4px",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                <TreeBlock
                  files={treeData}
                  onFileClick={(path) => {
                    extensionService.postMessage({
                      command: "openFile",
                      path,
                    });
                  }}
                />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
