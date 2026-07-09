import React from "react";

interface DiffSummaryBarProps {
  totalChanges: number;
  addedLines: number;
  removedLines: number;
  onClick?: () => void;
}

const DiffSummaryBar: React.FC<DiffSummaryBarProps> = ({
  totalChanges,
  addedLines,
  removedLines,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        width: "98%",
        margin: "0 auto",
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "var(--input-bg)",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        borderTopLeftRadius: "6px",
        borderTopRightRadius: "6px",
        borderBottomLeftRadius: "0",
        borderBottomRightRadius: "0",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* File Plus Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          color: "var(--vscode-descriptionForeground)",
          flexShrink: 0,
        }}
      >
        <path d="m9 18 6-6-6-6" />
      </svg>

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
            color: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
          }}
        >
          +{addedLines}
        </span>
        {" "}
        <span
          style={{
            color: "var(--vscode-gitDecoration-deletedResourceForeground, #f85149)",
          }}
        >
          -{removedLines}
        </span>
      </span>
    </div>
  );
};

export default DiffSummaryBar;
