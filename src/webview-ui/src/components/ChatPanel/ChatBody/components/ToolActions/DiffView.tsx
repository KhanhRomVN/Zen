import React from "react";

interface DiffLine {
  type: "added" | "removed" | "context" | "separator";
  content: string;
  lineNumBefore?: number;
  lineNumAfter?: number;
}

interface DiffViewProps {
  filePath: string;
  beforeContent: string;
  afterContent: string;
}

/**
 * Computes LCS (Longest Common Subsequence) edit script between two arrays of strings.
 * Returns an array of edit operations: "=" (equal), "+" (added), "-" (removed).
 */
function computeLCS(before: string[], after: string[]): Array<{ type: "=" | "+" | "-"; line: string }> {
  const m = before.length;
  const n = after.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (before[i] === after[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Trace back to build edit script
  const edits: Array<{ type: "=" | "+" | "-"; line: string }> = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && before[i] === after[j]) {
      edits.push({ type: "=", line: before[i] });
      i++;
      j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      edits.push({ type: "+", line: after[j] });
      j++;
    } else {
      edits.push({ type: "-", line: before[i] });
      i++;
    }
  }
  return edits;
}

/**
 * Computes a unified diff between `before` and `after` strings.
 * Groups changes into hunks with `contextLines` lines of surrounding context.
 * Inserts a "separator" line between hunks that are far apart.
 */
export function computeUnifiedDiff(before: string, after: string, contextLines = 3): DiffLine[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  // Remove trailing empty line caused by trailing newline
  if (beforeLines[beforeLines.length - 1] === "") beforeLines.pop();
  if (afterLines[afterLines.length - 1] === "") afterLines.pop();

  const edits = computeLCS(beforeLines, afterLines);

  // Assign line numbers to each edit
  interface EditWithNums {
    type: "=" | "+" | "-";
    line: string;
    lineNumBefore?: number;
    lineNumAfter?: number;
  }

  const editsWithNums: EditWithNums[] = [];
  let lineB = 1;
  let lineA = 1;
  for (const edit of edits) {
    if (edit.type === "=") {
      editsWithNums.push({ type: "=", line: edit.line, lineNumBefore: lineB, lineNumAfter: lineA });
      lineB++;
      lineA++;
    } else if (edit.type === "-") {
      editsWithNums.push({ type: "-", line: edit.line, lineNumBefore: lineB });
      lineB++;
    } else {
      editsWithNums.push({ type: "+", line: edit.line, lineNumAfter: lineA });
      lineA++;
    }
  }

  // Find indices of changed lines (added or removed)
  const changedIndices = editsWithNums
    .map((e, i) => (e.type !== "=" ? i : -1))
    .filter((i) => i !== -1);

  if (changedIndices.length === 0) {
    return [];
  }

  // Build hunks: ranges of edit indices to include
  const hunks: Array<[number, number]> = [];
  let hunkStart = Math.max(0, changedIndices[0] - contextLines);
  let hunkEnd = Math.min(editsWithNums.length - 1, changedIndices[0] + contextLines);

  for (let k = 1; k < changedIndices.length; k++) {
    const idx = changedIndices[k];
    const newStart = Math.max(0, idx - contextLines);
    const newEnd = Math.min(editsWithNums.length - 1, idx + contextLines);

    if (newStart <= hunkEnd + 1) {
      // Merge with current hunk
      hunkEnd = Math.max(hunkEnd, newEnd);
    } else {
      hunks.push([hunkStart, hunkEnd]);
      hunkStart = newStart;
      hunkEnd = newEnd;
    }
  }
  hunks.push([hunkStart, hunkEnd]);

  // Build DiffLine array from hunks
  const result: DiffLine[] = [];
  for (let h = 0; h < hunks.length; h++) {
    if (h > 0) {
      result.push({ type: "separator", content: "..." });
    }
    const [start, end] = hunks[h];
    for (let i = start; i <= end; i++) {
      const e = editsWithNums[i];
      if (e.type === "=") {
        result.push({
          type: "context",
          content: " " + e.line,
          lineNumBefore: e.lineNumBefore,
          lineNumAfter: e.lineNumAfter,
        });
      } else if (e.type === "+") {
        result.push({
          type: "added",
          content: "+" + e.line,
          lineNumAfter: e.lineNumAfter,
        });
      } else {
        result.push({
          type: "removed",
          content: "-" + e.line,
          lineNumBefore: e.lineNumBefore,
        });
      }
    }
  }

  return result;
}

const DiffView: React.FC<DiffViewProps> = ({ filePath, beforeContent, afterContent }) => {
  const filename = filePath.split("/").pop() || filePath;

  const diffLines = React.useMemo(
    () => computeUnifiedDiff(beforeContent, afterContent),
    [beforeContent, afterContent],
  );

  const noChanges = beforeContent === afterContent;

  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;

  const containerStyle: React.CSSProperties = {
    border: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))",
    borderRadius: "4px",
    overflow: "hidden",
    fontSize: "12px",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    background: "var(--vscode-editor-background, #1e1e1e)",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))",
    fontSize: "12px",
  };

  const scrollableStyle: React.CSSProperties = {
    maxHeight: "400px",
    overflowY: "auto",
    background: "var(--vscode-editor-background, #1e1e1e)",
  };

  const gutterStyle: React.CSSProperties = {
    display: "inline-block",
    width: "40px",
    textAlign: "right",
    paddingRight: "6px",
    color: "var(--vscode-editorLineNumber-foreground, rgba(255,255,255,0.3))",
    userSelect: "none",
    flexShrink: 0,
  };

  const getLineStyle = (type: DiffLine["type"]): React.CSSProperties => {
    switch (type) {
      case "added":
        return {
          background: "rgba(70, 149, 74, 0.15)",
          color: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
          display: "flex",
          whiteSpace: "pre",
        };
      case "removed":
        return {
          background: "rgba(229, 83, 75, 0.15)",
          color: "var(--vscode-gitDecoration-deletedResourceForeground, #f85149)",
          display: "flex",
          whiteSpace: "pre",
        };
      case "context":
        return {
          background: "transparent",
          color: "var(--vscode-editor-foreground, #d4d4d4)",
          display: "flex",
          whiteSpace: "pre",
        };
      case "separator":
        return {
          background: "transparent",
          color: "var(--vscode-descriptionForeground, rgba(255,255,255,0.4))",
          display: "flex",
          justifyContent: "center",
          padding: "2px 0",
          fontStyle: "italic",
        };
    }
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span
          style={{
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            color: "var(--vscode-editor-foreground, #d4d4d4)",
            fontWeight: 500,
            opacity: 0.9,
          }}
        >
          {filename}
        </span>
        {!noChanges && (
          <span style={{ display: "flex", gap: "4px", opacity: 0.8, fontWeight: 500 }}>
            <span style={{ color: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)" }}>
              +{addedCount}
            </span>
            <span style={{ color: "var(--vscode-gitDecoration-deletedResourceForeground, #f85149)" }}>
              -{removedCount}
            </span>
          </span>
        )}
      </div>

      {/* Body */}
      <div style={scrollableStyle}>
        {noChanges ? (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "var(--vscode-descriptionForeground, rgba(255,255,255,0.4))",
              fontStyle: "italic",
            }}
          >
            No changes
          </div>
        ) : (
          diffLines.map((line, idx) => {
            const lineStyle = getLineStyle(line.type);

            if (line.type === "separator") {
              return (
                <div key={idx} style={lineStyle}>
                  <span style={{ opacity: 0.5 }}>...</span>
                </div>
              );
            }

            return (
              <div key={idx} style={lineStyle}>
                {/* Before line number gutter */}
                <span style={gutterStyle}>
                  {line.lineNumBefore !== undefined ? line.lineNumBefore : ""}
                </span>
                {/* After line number gutter */}
                <span style={gutterStyle}>
                  {line.lineNumAfter !== undefined ? line.lineNumAfter : ""}
                </span>
                {/* Line content */}
                <span style={{ flex: 1, paddingLeft: "4px" }}>{line.content}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DiffView;
