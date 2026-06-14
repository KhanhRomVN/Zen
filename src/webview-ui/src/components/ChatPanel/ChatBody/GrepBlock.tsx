import React, { useState } from "react";
import { ToolAction } from "../../../services/ResponseParser";
import { ToolHeader } from "../../ToolHeader";
import FileIcon from "../../common/FileIcon";
import { extensionService } from "../../../services/ExtensionService";

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
      /<grep_results\s+search="([^"]*)"\s+total_matches="(\d+)"\s+files="(\d*)"\s+files_searched="(\d+)"/
    );
    if (!headerMatch) {
      const emptyMatch = output.match(
        /<grep_results\s+search="([^"]*)"\s+total_matches="0"\s+files_searched="(\d+)"\s*\/>/
      );
      if (emptyMatch) {
        return { searchTerm: emptyMatch[1], pattern: emptyMatch[1], results: {}, totalFilesSearched: parseInt(emptyMatch[2], 10), totalMatches: 0 };
      }
      return null;
    }
    const searchTerm = headerMatch[1];
    const totalMatches = parseInt(headerMatch[2], 10);
    const totalFilesSearched = parseInt(headerMatch[4], 10);
    const results: Record<string, MatchResult[]> = {};
    const fileRegex = /<file\s+path="([^"]*)"\s+matches="\d+">([\s\S]*?)<\/file>/g;
    let fileMatch: RegExpExecArray | null;
    while ((fileMatch = fileRegex.exec(output)) !== null) {
      const filePath = fileMatch[1];
      const fileContent = fileMatch[2];
      const matches: MatchResult[] = [];
      const lineRegex = /^\s*(\d+):\s(.*)$/gm;
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = lineRegex.exec(fileContent)) !== null) {
        matches.push({ lineNumber: parseInt(lineMatch[1], 10), lineContent: lineMatch[2] });
      }
      if (matches.length > 0) results[filePath] = matches;
    }
    return { searchTerm, pattern: searchTerm, results, totalFilesSearched, totalMatches };
  } catch { return null; }
}

const getDisplayPath = (fullPath: string): string => {
  if (!fullPath) return "";
  const parts = fullPath.split("/");
  return parts.length > 4 ? ".../" + parts.slice(-3).join("/") : fullPath;
};

const GrepBlock: React.FC<GrepBlockProps> = ({
  action,
  actionId,
  toolOutputs,
  isPartial,
  isCompleted,
  isError,
  errorMessage,
}) => {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);

  const searchTerm = action.params.search_term || action.params.searchTerm || "";
  const folderPath = action.params.folder_path || action.params.folderPath || "";
  const filePath = action.params.file_path || action.params.filePath || "";
  const targetPath = folderPath || filePath || "";
  const isFolderTarget = !!folderPath;

  const parseGrepResult = (): GrepResultData | null => {
    const output = toolOutputs?.[actionId]?.output;
    if (!output) return null;
    if (output.includes("<grep_results")) return parseCompactGrepOutput(output);
    try {
      const parsed = JSON.parse(output);
      if (parsed.searchTerm !== undefined) return parsed as GrepResultData;
      if (parsed.success && parsed.data) return parsed.data as GrepResultData;
      return null;
    } catch { return null; }
  };

  const grepResult = parseGrepResult();
  const hasResults = grepResult && grepResult.totalMatches > 0;

  const toggleFileCollapse = (filePathKey: string) => {
    setCollapsedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.has(filePathKey) ? newSet.delete(filePathKey) : newSet.add(filePathKey);
      return newSet;
    });
  };

  const openFileAtLine = (filePathLine: string, lineNumber: number) => {
    extensionService.postMessage({ command: "openFileAtLine", path: filePathLine, line: lineNumber });
  };

  let statusColor = "var(--vscode-descriptionForeground)";
  if (isError) statusColor = "var(--vscode-errorForeground)";
  else if (isCompleted && hasResults) statusColor = "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";

  const displayPath = getDisplayPath(targetPath);

  // Title dùng chung — click vào để toggle collapse
  const buildTitle = (opts?: { showSpinner?: boolean; totalMatches?: number; fileCount?: number; showStats?: boolean }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--vscode-editor-foreground)", cursor: opts?.showStats !== undefined ? "pointer" : "default" }}>
      <span style={{ fontWeight: 600, opacity: 0.8 }}>GREP</span>
      {(opts?.showStats !== undefined ? (grepResult?.searchTerm || searchTerm) : searchTerm) && (
        <span style={{
          fontFamily: "var(--vscode-editor-font-family, monospace)", fontSize: "11px", fontWeight: 600,
          color: "var(--vscode-textLink-foreground)", padding: "0 5px",
          backgroundColor: "color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent)", borderRadius: "3px",
        }}>
          {opts?.showStats !== undefined ? (grepResult?.searchTerm || searchTerm) : searchTerm}
        </span>
      )}
      {targetPath && (
        <>
          <span style={{ opacity: 0.4, fontSize: "11px" }}>in</span>
          <FileIcon path={targetPath} isFolder={isFolderTarget} style={{ width: "14px", height: "14px" }} />
          <span style={{ fontWeight: 500, opacity: 0.8, fontFamily: "var(--vscode-editor-font-family, monospace)", fontSize: "11px" }}>
            {displayPath || "..."}
          </span>
        </>
      )}
      {opts?.showSpinner && (
        <span style={{ fontSize: "10px", opacity: 0.55, display: "flex", alignItems: "center", gap: "4px" }}>
          <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: "10px" }} />
          Searching...
        </span>
      )}
      {opts?.showStats && opts.totalMatches !== undefined && (
        opts.totalMatches > 0 ? (
          <span style={{ opacity: 0.5, fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
            {opts.totalMatches} {opts.totalMatches === 1 ? "match" : "matches"} in {opts.fileCount} {opts.fileCount === 1 ? "file" : "files"}
          </span>
        ) : (
          <span style={{ opacity: 0.5, fontSize: "10px", color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>no matches</span>
        )
      )}
      {opts?.showStats && (
        <span className={`codicon codicon-chevron-${isResultsCollapsed ? "right" : "down"}`} style={{ fontSize: "10px", opacity: 0.5, marginLeft: "2px" }} />
      )}
    </div>
  );

  if (isPartial && !isCompleted) {
    return (
      <div className="timeline-item" style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "29px", paddingBottom: "8px" }}>
        <ToolHeader title={buildTitle({ showSpinner: true })} statusColor={statusColor} isPartial={true} onClick={() => {}} />
      </div>
    );
  }

  if (isError && errorMessage) {
    return (
      <div className="timeline-item" style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "29px", paddingBottom: "8px" }}>
        <ToolHeader title={buildTitle()} statusColor={statusColor} isPartial={false} onClick={() => {}} />
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "6px", padding: "5px 8px",
          backgroundColor: "color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)",
          border: "1px solid color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)",
          borderRadius: "4px", marginTop: "2px",
        }}>
          <span className="codicon codicon-error" style={{ fontSize: "11px", color: "var(--vscode-errorForeground)", opacity: 0.7, marginTop: "1px", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: "var(--vscode-errorForeground)", opacity: 0.85, fontFamily: "var(--vscode-editor-font-family, monospace)", wordBreak: "break-word" }}>
            {errorMessage}
          </span>
        </div>
      </div>
    );
  }

  if (!grepResult || !isCompleted) return null;

  const { results, totalMatches } = grepResult;
  const filePaths = Object.keys(results);
  const fileCount = filePaths.length;

  return (
    <div className="timeline-item" style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "29px", paddingBottom: "8px" }}>
      {/* Header — click để toggle collapse */}
      <ToolHeader
        title={buildTitle({ showStats: true, totalMatches, fileCount })}
        statusColor={statusColor}
        isPartial={false}
        onClick={() => setIsResultsCollapsed(v => !v)}
      />

      {hasResults && !isResultsCollapsed && (
        <div style={{
          maxHeight: "320px", overflowY: "auto", marginTop: "2px",
          borderLeft: "2px solid color-mix(in srgb, var(--vscode-button-background) 30%, transparent)",
          paddingLeft: "12px",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--vscode-scrollbarSlider-background) transparent",
        }}>
          {filePaths.map((filePathKey) => {
            const matches = results[filePathKey];
            const isCollapsed = collapsedFiles.has(filePathKey);
            const displayFilePath = getDisplayPath(filePathKey);

            return (
              <div key={filePathKey} style={{ marginBottom: "12px" }}>
                <div
                  onClick={() => toggleFileCollapse(filePathKey)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "2px 0", marginBottom: isCollapsed ? "0" : "6px", userSelect: "none" }}
                >
                  <span className={`codicon codicon-chevron-${isCollapsed ? "right" : "down"}`} style={{ fontSize: "12px", opacity: 0.6, color: "var(--vscode-descriptionForeground)" }} />
                  <span className="codicon codicon-file" style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", opacity: 0.7 }} />
                  <span style={{ fontFamily: "var(--vscode-editor-font-family, monospace)", fontSize: "11px", fontWeight: 500, color: "var(--vscode-textLink-foreground)" }}>
                    {displayFilePath}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", opacity: 0.5, marginLeft: "auto" }}>
                    {matches.length} {matches.length === 1 ? "line" : "lines"}
                  </span>
                </div>

                {!isCollapsed && (
                  <div style={{ marginLeft: "18px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {matches.map((match, idx) => (
                      <div
                        key={`${filePathKey}-${match.lineNumber}-${idx}`}
                        onClick={() => openFileAtLine(filePathKey, match.lineNumber)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "8px",
                          padding: "2px 4px", borderRadius: "3px", cursor: "pointer",
                          fontFamily: "var(--vscode-editor-font-family, monospace)", fontSize: "11px", lineHeight: "1.4",
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground, rgba(255,255,255,0.05))"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <span style={{ minWidth: "32px", color: "var(--vscode-editorLineNumber-foreground)", opacity: 0.65, textAlign: "right", flexShrink: 0 }}>
                          {match.lineNumber}
                        </span>
                        <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--vscode-editor-foreground)", opacity: 0.9 }}>
                          {match.lineContent}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hasResults && grepResult.totalFilesSearched > 0 && (
        <div style={{
          marginTop: "4px", padding: "8px 12px",
          backgroundColor: "color-mix(in srgb, var(--vscode-editor-background) 50%, transparent)",
          borderRadius: "4px", fontSize: "11px", color: "var(--vscode-descriptionForeground)", textAlign: "center",
        }}>
          <span className="codicon codicon-search-stop" style={{ marginRight: "6px" }} />
          No results for "{grepResult.searchTerm}" in {grepResult.totalFilesSearched} files
        </div>
      )}
    </div>
  );
};

export default GrepBlock;
