import React from "react";
import { FullContentView } from "./FullContentView";
import DiffView from "./DiffView";

export interface SnapshotData {
  filePath: string;
  operation: "write" | "replace";
  beforeContent: string | null;
  afterContent: string;
  timestamp: number;
}

interface InlineViewerProps {
  loading: boolean;
  error: string | null;
  snapshot: SnapshotData | null;
  filePath: string;
  onOpenFile: () => void;
}

const InlineViewer: React.FC<InlineViewerProps> = ({
  loading,
  error,
  snapshot,
  onOpenFile,
}) => {
  const containerStyle: React.CSSProperties = {
    marginTop: "8px",
    marginLeft: "-29px",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            color: "var(--vscode-descriptionForeground, rgba(255,255,255,0.4))",
            fontSize: "12px",
            padding: "8px",
          }}
        >
          <span className="codicon codicon-loading codicon-modifier-spin" />
          <span>Loading snapshot...</span>
        </div>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--vscode-editorWarning-foreground, rgba(229, 83, 75, 0.8))",
            fontSize: "12px",
            padding: "6px 0",
          }}
        >
          <span>{error}</span>
          <button
            onClick={onOpenFile}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--vscode-textLink-foreground, #3794ff)",
              fontSize: "12px",
              textDecoration: "underline",
            }}
          >
            Open in Editor
          </button>
        </div>
      </div>
    );
  }

  if (snapshot !== null && snapshot.operation === "write") {
    return (
      <div style={containerStyle}>
        <FullContentView
          filePath={snapshot.filePath}
          content={snapshot.afterContent}
          beforeContent={snapshot.beforeContent}
        />
      </div>
    );
  }

  if (snapshot !== null && snapshot.operation === "replace") {
    return (
      <div style={containerStyle}>
        <DiffView
          filePath={snapshot.filePath}
          beforeContent={snapshot.beforeContent ?? ""}
          afterContent={snapshot.afterContent}
        />
      </div>
    );
  }

  return null;
};

export default InlineViewer;
