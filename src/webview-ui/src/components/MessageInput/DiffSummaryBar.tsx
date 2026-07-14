import React from "react";
import { getFileIconPath } from "@/utils/fileIconMapper";
import { Undo2 } from "lucide-react";
import RevertConfirmModal from "@/components/RevertConfirmModal";

interface ResponseRange {
  start: number;
  end: number;
  isCurrent: boolean;
  messageId?: string;
  timestamp?: number;
  fileChanges: Map<
    string,
    {
      additions: number;
      deletions: number;
      toolType?: "write_to_file" | "replace_in_file";
      content?: string;
      oldContent?: string;
      newContent?: string;
    }
  >;
}

interface DiffSummaryBarProps {
  totalChanges: number;
  addedLines: number;
  removedLines: number;
  onClick?: () => void;
  onReviewClick?: () => void;
  onRevert?: (messageId: string, timestamp: number) => void;
  responseRange?: { start: number; end: number } | null;
  responseRanges?: ResponseRange[];
}

const DiffSummaryBar: React.FC<DiffSummaryBarProps> = ({
  totalChanges,
  addedLines,
  removedLines,
  onClick,
  onReviewClick,
  onRevert,
  responseRange,
  responseRanges = [],
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isReviewHovered, setIsReviewHovered] = React.useState(false);
  const [showRevertModal, setShowRevertModal] = React.useState(false);
  const [pendingRevert, setPendingRevert] = React.useState<{
    messageId: string;
    timestamp: number;
  } | null>(null);

  const rangeText = React.useMemo(() => {
    // Find current range and use it for summary
    const currentRange = responseRanges.find((r) => r.isCurrent);
    if (currentRange) {
      return `(${currentRange.start}-${currentRange.end})`;
    }
    // Fallback to responseRange if no current found
    return responseRange ? `(${responseRange.start}-${responseRange.end})` : "";
  }, [responseRange, responseRanges]);

  const handleReviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleFileClick = (
    filePath: string,
    fileData?: {
      toolType?: "write_to_file" | "replace_in_file";
      content?: string;
      oldContent?: string;
      newContent?: string;
    },
  ) => {
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) return;

    // Use tool type from fileData if available
    if (fileData?.toolType === "write_to_file" && fileData.content) {
      vscodeApi.postMessage({
        command: "openWriteToFile",
        filePath: filePath,
        content: fileData.content,
      });
    } else if (
      fileData?.toolType === "replace_in_file" &&
      fileData.oldContent &&
      fileData.newContent
    ) {
      vscodeApi.postMessage({
        command: "openReplaceInFileDiff",
        filePath: filePath,
        oldContent: fileData.oldContent,
        newContent: fileData.newContent,
      });
    } else {
      // Fallback to openFileDiff for backward compatibility
      vscodeApi.postMessage({
        command: "openFileDiff",
        path: filePath,
      });
    }
  };

  const getFileName = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  const getSmartPath = (
    fullPath: string,
    availableWidth: number = 300,
  ): { display: string; isTruncated: boolean } => {
    const parts = fullPath.split(/[/\\]/);

    if (parts.length <= 2) {
      return { display: fullPath, isTruncated: false };
    }

    const fileName = parts[parts.length - 1];
    const folders = parts.slice(0, -1);

    // Estimate character width (monospace font ~6px per char at 10px font size)
    const charWidth = 6;
    const maxChars = Math.floor(availableWidth / charWidth);

    // Try showing progressively more folders from the start
    // folder1/.../file
    // folder1/folder2/.../file
    // folder1/folder2/folder3/.../file
    // etc.

    for (let numFolders = 1; numFolders <= folders.length; numFolders++) {
      let pathCandidate: string;

      if (numFolders === folders.length) {
        // Show full path without ellipsis
        pathCandidate = fullPath;
      } else {
        // Show first N folders + ... + filename
        const visibleFolders = folders.slice(0, numFolders).join("/");
        pathCandidate = `${visibleFolders}/.../${fileName}`;
      }

      if (pathCandidate.length <= maxChars) {
        // This fits, but let's check if we can show one more folder
        if (numFolders < folders.length) {
          const nextCandidate =
            numFolders + 1 === folders.length
              ? fullPath
              : `${folders.slice(0, numFolders + 1).join("/")}/.../${fileName}`;

          if (nextCandidate.length <= maxChars) {
            // Next one also fits, continue to try more
            continue;
          }
        }

        // This is the best fit
        return {
          display: pathCandidate,
          isTruncated: numFolders < folders.length,
        };
      }

      // This doesn't fit, use previous (if any)
      if (numFolders === 1) {
        // Even folder1/.../file doesn't fit, just show filename
        return { display: fileName, isTruncated: true };
      }

      // Use previous iteration
      const prevFolders = folders.slice(0, numFolders - 1).join("/");
      return {
        display: `${prevFolders}/.../${fileName}`,
        isTruncated: true,
      };
    }

    // Fallback: show full path
    return { display: fullPath, isTruncated: false };
  };

  const handleOpenOriginalFile = (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openFile",
        path: filePath,
      });
    }
  };

  return (
    <div
      style={{
        width: "98%",
        margin: "0 auto",
        background: "var(--input-bg)",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        borderTopLeftRadius: "6px",
        borderTopRightRadius: "6px",
        borderBottomLeftRadius: "0",
        borderBottomRightRadius: "0",
        overflow: "hidden",
      }}
    >
      {/* Summary Bar */}
      <div
        onClick={onClick}
        style={{
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          cursor: onClick ? "pointer" : "default",
        }}
      >
        {/* Total Changes */}
        <span
          style={{
            fontSize: "13px",
            fontFamily: "var(--vscode-font-family)",
            color: "var(--vscode-foreground)",
          }}
        >
          {totalChanges} {totalChanges === 1 ? "file changed" : "files changed"}
        </span>

        {/* Diff Stats */}
        <span
          style={{
            fontSize: "13px",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            color: "var(--vscode-descriptionForeground)",
          }}
        >
          <span
            style={{
              color: "var(--vscode-gitDecoration-addedResourceForeground)",
            }}
          >
            +{addedLines}
          </span>{" "}
          <span
            style={{
              color: "var(--vscode-gitDecoration-deletedResourceForeground)",
            }}
          >
            -{removedLines}
          </span>
        </span>

        {/* Response Range */}
        {rangeText && (
          <span
            style={{
              fontSize: "13px",
              fontFamily: "var(--vscode-font-family)",
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            {rangeText}
          </span>
        )}

        {/* Review Button */}
        <span
          onClick={handleReviewClick}
          onMouseEnter={() => setIsReviewHovered(true)}
          onMouseLeave={() => setIsReviewHovered(false)}
          style={{
            fontSize: "13px",
            fontFamily: "var(--vscode-font-family)",
            color: "var(--vscode-textLink-foreground, #3b82f6)",
            cursor: "pointer",
            textDecoration: isReviewHovered ? "underline" : "none",
            marginLeft: "auto",
          }}
        >
          {isExpanded ? "Close" : "Review all"}
        </span>
      </div>

      {/* Expanded File List by Ranges */}
      {isExpanded && (
        <div
          style={{
            borderTop: "1px solid var(--vscode-widget-border)",
            padding: "12px",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {responseRanges.length === 0 ? (
            <div
              style={{
                fontSize: "13px",
                color: "var(--vscode-descriptionForeground)",
                textAlign: "center",
                padding: "20px",
              }}
            >
              No file changes
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {responseRanges.map((range, rangeIdx) => {
                const fileChangesArray = Array.from(
                  range.fileChanges.entries(),
                ).map(([path, stats]) => ({
                  path,
                  additions: stats.additions,
                  deletions: stats.deletions,
                  toolType: stats.toolType,
                  content: stats.content,
                  oldContent: stats.oldContent,
                  newContent: stats.newContent,
                }));

                return (
                  <div key={rangeIdx}>
                    {/* Range Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                        paddingBottom: "6px",
                        borderBottom: "1px solid var(--vscode-widget-border)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--vscode-foreground)",
                          fontFamily: "var(--vscode-font-family)",
                        }}
                      >
                        Responses ({range.start}-{range.end})
                      </span>
                      {range.isCurrent && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "3px",
                            background: "var(--vscode-badge-background)",
                            color: "var(--vscode-badge-foreground)",
                          }}
                        >
                          CURRENT
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (range.messageId && range.timestamp) {
                            console.log("[REVERT-DEBUG] DiffSummaryBar: REVERT button clicked", {
                              rangeStart: range.start,
                              rangeEnd: range.end,
                              isCurrent: range.isCurrent,
                              messageId: range.messageId,
                              timestamp: range.timestamp,
                            });
                            setPendingRevert({
                              messageId: range.messageId,
                              timestamp: range.timestamp,
                            });
                            setShowRevertModal(true);
                          } else {
                            console.warn("[REVERT-DEBUG] DiffSummaryBar: REVERT clicked but no messageId/timestamp", {
                              messageId: range.messageId,
                              timestamp: range.timestamp,
                            });
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 6px",
                          fontSize: "10px",
                          fontWeight: 600,
                          borderRadius: "3px",
                          border: "1px solid var(--vscode-widget-border)",
                          background: "transparent",
                          color: "var(--vscode-foreground)",
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "var(--vscode-list-hoverBackground)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        title={
                          range.isCurrent
                            ? "Revert changes"
                            : "Revert to this range"
                        }
                      >
                        <Undo2 size={10} />
                        REVERT
                      </button>
                    </div>

                    {/* Files in this range */}
                    {fileChangesArray.length === 0 ? (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--vscode-descriptionForeground)",
                          padding: "12px 8px",
                          fontStyle: "italic",
                        }}
                      >
                        No file changes in this range
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        {fileChangesArray.map((file, fileIdx) => {
                          const smartPath = getSmartPath(file.path, 280);
                          const toolLabel =
                            file.toolType === "write_to_file"
                              ? "WRITE"
                              : "REPLACE";

                          return (
                            <div
                              key={fileIdx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 6px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontFamily:
                                  "var(--vscode-editor-font-family, monospace)",
                                color: "var(--vscode-foreground)",
                              }}
                            >
                              {/* Tool Label (clickable) */}
                              <span
                                onClick={() =>
                                  handleFileClick(file.path, {
                                    toolType: file.toolType,
                                    content: file.content,
                                    oldContent: file.oldContent,
                                    newContent: file.newContent,
                                  })
                                }
                                style={{
                                  fontWeight: 700,
                                  fontSize: "9px",
                                  color:
                                    file.toolType === "write_to_file"
                                      ? "var(--vscode-gitDecoration-addedResourceForeground)"
                                      : "var(--vscode-editorWarning-foreground)",
                                  flexShrink: 0,
                                  cursor: "pointer",
                                  textDecoration: "none",
                                  transition: "text-decoration 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration =
                                    "underline";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = "none";
                                }}
                              >
                                {toolLabel}
                              </span>

                              {/* File Icon */}
                              <img
                                src={getFileIconPath(file.path)}
                                alt=""
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  flexShrink: 0,
                                }}
                              />

                              {/* Filename (clickable) */}
                              <span
                                onClick={() =>
                                  handleFileClick(file.path, {
                                    toolType: file.toolType,
                                    content: file.content,
                                    oldContent: file.oldContent,
                                    newContent: file.newContent,
                                  })
                                }
                                style={{
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  cursor: "pointer",
                                  textDecoration: "none",
                                  transition: "text-decoration 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration =
                                    "underline";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = "none";
                                }}
                              >
                                {getFileName(file.path)}
                              </span>

                              {/* Smart Path (clickable - opens original file) */}
                              <span
                                onClick={(e) =>
                                  handleOpenOriginalFile(e, file.path)
                                }
                                title={file.path}
                                style={{
                                  color: "var(--vscode-descriptionForeground)",
                                  flexGrow: 1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontSize: "10px",
                                  cursor: "pointer",
                                  textDecoration: "none",
                                  transition: "text-decoration 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration =
                                    "underline";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = "none";
                                }}
                              >
                                {smartPath.display}
                              </span>

                              {/* Diff Stats */}
                              <span
                                style={{
                                  color:
                                    "var(--vscode-gitDecoration-addedResourceForeground)",
                                  flexShrink: 0,
                                  fontSize: "10px",
                                }}
                              >
                                +{file.additions}
                              </span>
                              <span
                                style={{
                                  color:
                                    "var(--vscode-gitDecoration-deletedResourceForeground)",
                                  flexShrink: 0,
                                  fontSize: "10px",
                                }}
                              >
                                -{file.deletions}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <RevertConfirmModal
        isOpen={showRevertModal}
        onClose={() => {
          setShowRevertModal(false);
          setPendingRevert(null);
        }}
        onConfirm={() => {
          if (pendingRevert) {
            console.log("[REVERT-DEBUG] DiffSummaryBar: Revert confirmed in modal", {
              messageId: pendingRevert.messageId,
              timestamp: pendingRevert.timestamp,
              hasOnRevert: !!onRevert,
            });
            onRevert?.(pendingRevert.messageId, pendingRevert.timestamp);
            setPendingRevert(null);
          } else {
            console.warn("[REVERT-DEBUG] DiffSummaryBar: Confirm but pendingRevert is null");
          }
        }}
      />
    </div>
  );
};

export default DiffSummaryBar;
