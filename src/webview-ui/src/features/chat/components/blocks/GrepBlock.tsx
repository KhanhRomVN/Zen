import React, { useState } from "react";
import { ToolAction } from "../../services/ResponseParser";
import { extensionService } from "../../../../services/ExtensionService";
import { getFileIconPath } from "../../../../utils/fileIconMapper";

interface GrepBlockProps {
  action: ToolAction;
  actionId: string;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  isPartial: boolean;
  isCompleted: boolean;
  isError: boolean;
  errorMessage: string;
  conversationId?: string;
  allMessages?: any[];
  /** If true, results are collapsed; parent controls this */
  isCollapsed?: boolean;
  /** Callback when parent wants to toggle collapse */
  onToggleCollapse?: () => void;
}

interface MatchResult {
  lineNumber: number;
  lineContent: string;
}

interface GrepResultData {
  searchTerm: string;
  pattern: string;
  results: Record<string, MatchResult[]>;
  totalFilesSearched: number;
  totalMatches: number;
}

function parseCompactGrepOutput(output: string): GrepResultData | null {
  if (!output) return null;
  try {
    const headerMatch = output.match(
      /<grep_results\s+search="([^"]*)"\s+total_matches="(\d+)"\s+files="(\d*)"\s+files_searched="(\d+)"/,
    );
    if (!headerMatch) {
      const emptyMatch = output.match(
        /<grep_results\s+search="([^"]*)"\s+total_matches="0"\s+files_searched="(\d+)"\s*\/>/,
      );
      if (emptyMatch) {
        return {
          searchTerm: emptyMatch[1],
          pattern: emptyMatch[1],
          results: {},
          totalFilesSearched: parseInt(emptyMatch[2], 10),
          totalMatches: 0,
        };
      }
      return null;
    }
    const searchTerm = headerMatch[1];
    const totalMatches = parseInt(headerMatch[2], 10);
    const totalFilesSearched = parseInt(headerMatch[4], 10);
    const results: Record<string, MatchResult[]> = {};
    const fileRegex =
      /<file\s+path="([^"]*)"\s+matches="\d+">([\s\S]*?)<\/file>/g;
    let fileMatch: RegExpExecArray | null;
    while ((fileMatch = fileRegex.exec(output)) !== null) {
      const filePath = fileMatch[1];
      const fileContent = fileMatch[2];
      const matches: MatchResult[] = [];
      const lineRegex = /^\s*(\d+):\s(.*)$/gm;
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = lineRegex.exec(fileContent)) !== null) {
        matches.push({
          lineNumber: parseInt(lineMatch[1], 10),
          lineContent: lineMatch[2],
        });
      }
      if (matches.length > 0) results[filePath] = matches;
    }
    return {
      searchTerm,
      pattern: searchTerm,
      results,
      totalFilesSearched,
      totalMatches,
    };
  } catch {
    return null;
  }
}

const getDisplayPath = (fullPath: string): string => {
  if (!fullPath) return "";
  const parts = fullPath.split("/");
  return parts.length > 4 ? ".../" + parts.slice(-3).join("/") : fullPath;
};

// Track which actionIds have been logged to avoid spam
const _loggedOutputs = new Set<string>();

// Highlight matching text within a line
const highlightMatch = (text: string, searchTerm: string): React.ReactNode => {
  if (!searchTerm || !text) return text;

  try {
    // Escape regex special characters
    const escaped = searchTerm
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) => {
      // Check if this part matches the search term
      if (part.toLowerCase() === searchTerm.toLowerCase()) {
        return (
          <span
            key={index}
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--vscode-editor-findMatchHighlightBackground) 60%, transparent)",
              color: "var(--vscode-editor-foreground)",
              fontWeight: "600",
              borderRadius: "2px",
              padding: "0 2px",
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  } catch (e) {
    console.warn("[GrepBlock] Failed to highlight:", e);
    return text;
  }
};

const GrepBlock: React.FC<GrepBlockProps> = ({
  action,
  actionId,
  toolOutputs,
  isPartial,
  isCompleted,
  isError,
  errorMessage,
  isCollapsed = false,
}) => {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const searchTerm =
    action.params.search_term || action.params.searchTerm || "";
  const folderPath =
    action.params.folder_path || action.params.folderPath || "";
  const filePath = action.params.file_path || action.params.filePath || "";
  const targetPath = folderPath || filePath || "";

  const parseGrepResult = (): GrepResultData | null => {
    const output = toolOutputs?.[actionId]?.output;
    if (!output) return null;

    if (!_loggedOutputs.has(actionId)) {
      _loggedOutputs.add(actionId);
    }

    if (output.includes("<grep_results")) {
      const result = parseCompactGrepOutput(output);
      return result;
    }
    try {
      const parsed = JSON.parse(output);
      if (parsed.searchTerm !== undefined) return parsed as GrepResultData;
      if (parsed.success && parsed.data) return parsed.data as GrepResultData;
      return null;
    } catch (e) {
      console.warn("[GrepBlock] Failed to parse output:", e);
      return null;
    }
  };

  const grepResult = parseGrepResult();
  const hasResults = grepResult && grepResult.totalMatches > 0;
  const filePaths = Object.keys(grepResult?.results || {});

  const toggleFileCollapse = (filePathKey: string) => {
    setCollapsedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.has(filePathKey)
        ? newSet.delete(filePathKey)
        : newSet.add(filePathKey);
      return newSet;
    });
  };

  const openFileAtLine = (filePathLine: string, lineNumber: number) => {
    const fullPath = filePathLine;
    extensionService.postMessage({
      command: "openFileAtLine",
      path: fullPath,
      line: lineNumber,
      selection: { startLine: lineNumber, endLine: lineNumber },
    });
    setTimeout(() => {
      extensionService.postMessage({ command: "openFile", path: fullPath });
    }, 200);
  };

  // Loading state: show spinner placeholder
  if (isPartial && !isCompleted) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "8px 0",
          color: "var(--vscode-descriptionForeground)",
          fontSize: "12px",
          opacity: 0.6,
        }}
      >
        <span
          className="codicon codicon-loading codicon-modifier-spin"
          style={{ fontSize: "12px" }}
        />
        <span>Searching...</span>
      </div>
    );
  }

  // Error state: show error message
  if (isError && errorMessage) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "6px",
          padding: "5px 8px",
          backgroundColor:
            "color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)",
          borderRadius: "4px",
        }}
      >
        <span
          className="codicon codicon-error"
          style={{
            fontSize: "11px",
            color: "var(--vscode-errorForeground)",
            opacity: 0.7,
            marginTop: "1px",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "11px",
            color: "var(--vscode-errorForeground)",
            opacity: 0.85,
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            wordBreak: "break-word",
          }}
        >
          {errorMessage}
        </span>
      </div>
    );
  }

  if (!grepResult || !isCompleted) return null;

  // If collapsed, render nothing (parent handles header)
  if (isCollapsed) {
    return null;
  }

  const { results } = grepResult;

  if (!hasResults) {
    return (
      <div
        style={{
          marginTop: "4px",
          padding: "8px 12px",
          backgroundColor:
            "color-mix(in srgb, var(--vscode-editor-background) 50%, transparent)",
          borderRadius: "4px",
          fontSize: "11px",
          color: "var(--vscode-descriptionForeground)",
          textAlign: "center",
        }}
      >
        <span
          className="codicon codicon-search-stop"
          style={{ marginRight: "6px" }}
        />
        No results for "{grepResult.searchTerm}" in{" "}
        {grepResult.totalFilesSearched} files
      </div>
    );
  }

  return (
    <div
      style={{
        maxHeight: "320px",
        overflowY: "auto",
        marginTop: "2px",
        background:
          "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        borderRadius: "4px",
        padding: "6px 10px",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--vscode-scrollbarSlider-background) transparent",
      }}
    >
      {filePaths.map((filePathKey) => {
        const matches = results[filePathKey];
        const isFileCollapsed = collapsedFiles.has(filePathKey);
        const displayFilePath = filePathKey.split(/[/\\]/).pop() || filePathKey;
        const fileIconPath = getFileIconPath(filePathKey);
        const searchTermLocal = grepResult.searchTerm;

        return (
          <div key={filePathKey} style={{ marginBottom: "12px" }}>
            <div
              onClick={() => toggleFileCollapse(filePathKey)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                padding: "2px 0",
                marginBottom: isFileCollapsed ? "0" : "6px",
                userSelect: "none",
              }}
            >
              <span
                className={`codicon codicon-chevron-${isFileCollapsed ? "right" : "down"}`}
                style={{
                  fontSize: "12px",
                  opacity: 0.6,
                  color: "var(--vscode-descriptionForeground)",
                }}
              />
              <img
                src={fileIconPath}
                alt="file icon"
                style={{ width: "14px", height: "14px", flexShrink: 0 }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const fallback = document.createElement("span");
                    fallback.className = "codicon codicon-file";
                    fallback.style.cssText =
                      "font-size: 12px; color: var(--vscode-descriptionForeground); opacity: 0.7; flex-shrink: 0;";
                    parent.insertBefore(fallback, e.currentTarget);
                  }
                }}
              />
              <span
                style={{
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--vscode-editor-foreground)",
                }}
              >
                {displayFilePath}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--vscode-descriptionForeground)",
                  opacity: 0.5,
                  marginLeft: "auto",
                }}
              >
                {matches.length} {matches.length === 1 ? "line" : "lines"}
              </span>
            </div>

            {!isFileCollapsed && (
              <div
                style={{
                  marginLeft: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                {matches.map((match, idx) => (
                  <div
                    key={`${filePathKey}-${match.lineNumber}-${idx}`}
                    onClick={() => {
                      openFileAtLine(filePathKey, match.lineNumber);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      padding: "2px 4px",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                      fontSize: "11px",
                      lineHeight: "1.4",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--vscode-list-hoverBackground, rgba(255,255,255,0.05))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span
                      style={{
                        minWidth: "32px",
                        color: "var(--vscode-editorLineNumber-foreground)",
                        opacity: 0.65,
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {match.lineNumber}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        color: "var(--vscode-editor-foreground)",
                        opacity: 0.9,
                      }}
                    >
                      {highlightMatch(match.lineContent, searchTermLocal)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GrepBlock;
