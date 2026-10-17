import React from "react";

const BRANCH = "var(--vscode-charts-purple, #a78bfa)";
const MUTED = "var(--vscode-descriptionForeground, #9d9d9d)";
const MONO = "var(--vscode-editor-font-family, monospace)";
const CONNECTOR =
  "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent)";

const tint = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

interface RepoBranchLineProps {
  repoLabel: string;
  branchLabel: string;
  title?: string;
  gap?: number;
}

export const RepoBranchLine: React.FC<RepoBranchLineProps> = ({
  repoLabel,
  branchLabel,
  title,
  gap = 0,
}) => (
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "-6px",
      paddingTop: `${4 + gap}px`,
      paddingLeft: "44px",
      fontSize: "11px",
      fontFamily: MONO,
      color: MUTED,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "24px",
        top: "0px",
        width: "16px",
        height: `${12 + gap}px`,
        borderLeft: CONNECTOR,
        borderBottom: CONNECTOR,
      }}
    />
    {repoLabel && (
      <span
        title={title}
        style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
      >
        <span
          className="codicon codicon-folder"
          style={{ fontSize: "13px", opacity: 0.8 }}
        />
        <span>{repoLabel}</span>
      </span>
    )}
    {branchLabel && (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "1px 8px",
          height: "18px",
          borderRadius: "4px",
          fontWeight: 500,
          color: BRANCH,
          background: tint(BRANCH, 15),
          border: `1px solid ${tint(BRANCH, 25)}`,
        }}
      >
        <span
          className="codicon codicon-git-branch"
          style={{ fontSize: "12px" }}
        />
        {branchLabel}
      </span>
    )}
  </div>
);