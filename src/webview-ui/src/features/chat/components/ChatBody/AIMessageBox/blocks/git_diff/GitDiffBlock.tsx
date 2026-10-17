import React from "react";
import "./GitDiffBlock.css";

export interface GitDiffBlockProps {
  diffContent: string;
}

type LineType = "added" | "removed" | "context" | "empty";

const ADDED = "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
const REMOVED = "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)";
const MONO = "var(--vscode-editor-font-family, monospace)";

const parseDiffContent = (
  content: string,
): { lines: string[]; types: LineType[] } => {
  const lines: string[] = [];
  const types: LineType[] = [];
  let inHunk = false;

  for (const line of content.split("\n")) {
    if (line.startsWith("diff")) continue;
    if (line.startsWith("index ")) continue;
    if (line.startsWith("--- ") || line.startsWith("+++ ")) continue;

    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }

    if (line.startsWith("new file mode")) continue;
    if (line.startsWith("deleted file mode")) continue;
    if (line.includes("No newline at end of file")) continue;

    if (inHunk) {
      let text = line;
      let type: LineType = "context";

      if (line.startsWith("+") && !line.startsWith("+++")) {
        text = line.substring(1);
        type = "added";
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        text = line.substring(1);
        type = "removed";
      } else if (line.startsWith(" ")) {
        text = line.substring(1);
      } else if (line === "") {
        type = "empty";
      }

      if (text !== "" || line === "") {
        lines.push(text);
        types.push(type);
      }
    } else if (line.trim() !== "") {
      lines.push(line);
      types.push("context");
    }
  }

  return { lines, types };
};

const GitDiffBlock: React.FC<GitDiffBlockProps> = ({ diffContent }) => {
  const { lines, types } = parseDiffContent(diffContent);

  return (
    <div
      className="git-diff-block"
      style={{ padding: "0 12px 4px 16px" }}
    >
      <div
        style={{
          background:
            "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
          borderRadius: "4px",
          border:
            "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
          overflow: "auto",
          maxHeight: "400px",
          fontFamily: MONO,
          fontSize: "12px",
          lineHeight: "1.5",
          padding: "4px 0",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {lines.map((line, index) => {
          const type = types[index] || "context";

          if (type === "empty") {
            return (
              <div
                key={index}
                style={{
                  padding: "0 8px",
                  height: "20px",
                  fontFamily: MONO,
                  fontSize: "12px",
                  lineHeight: "1.5",
                }}
              />
            );
          }

          const color =
            type === "added"
              ? ADDED
              : type === "removed"
                ? REMOVED
                : "var(--vscode-editor-foreground)";
          const backgroundColor =
            type === "context"
              ? "transparent"
              : `color-mix(in srgb, ${color} 12%, transparent)`;

          return (
            <div
              key={index}
              style={{
                padding: "0 8px",
                color,
                backgroundColor,
                fontFamily: MONO,
                fontSize: "12px",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                minHeight: "20px",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { GitDiffBlock };
export default GitDiffBlock;