import React, { useEffect, useRef, useState } from "react";

interface FullContentViewProps {
  filePath: string;
  content: string;
  beforeContent: string | null; // null = CREATE, non-null = REWRITE
}

const getBasename = (filePath: string): string => {
  return filePath.split(/[\\/]/).pop() || filePath;
};

// Lines per animation tick — larger = faster scroll
const LINES_PER_TICK = 4;
// Interval between ticks in ms
const TICK_MS = 16;

export const FullContentView: React.FC<FullContentViewProps> = ({
  filePath,
  content,
  beforeContent,
}) => {
  const isCreate = beforeContent === null;
  const basename = getBasename(filePath);
  const lines = content ? content.split("\n") : [];
  const lineCount = lines.length;

  // How many lines are currently visible (drives the typewriter effect)
  const [visibleCount, setVisibleCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Reset and re-animate whenever content changes
  useEffect(() => {
    if (!lines.length) return;

    setVisibleCount(0);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setVisibleCount((prev) => {
        const next = prev + LINES_PER_TICK;
        if (next >= lines.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return lines.length;
        }
        return next;
      });
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // intentionally only on content change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Auto-scroll to bottom while animating
  useEffect(() => {
    if (contentAreaRef.current && visibleCount < lineCount) {
      contentAreaRef.current.scrollTop = contentAreaRef.current.scrollHeight;
    }
  }, [visibleCount, lineCount]);

  const badgeStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: "3px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: isCreate
      ? "var(--vscode-gitDecoration-addedResourceForeground)"
      : "var(--vscode-gitDecoration-modifiedResourceForeground)",
    border: `1px solid ${
      isCreate
        ? "var(--vscode-gitDecoration-addedResourceForeground)"
        : "var(--vscode-gitDecoration-modifiedResourceForeground)"
    }`,
    opacity: 0.9,
  };

  const containerStyle: React.CSSProperties = {
    borderRadius: "6px",
    overflow: "hidden",
    border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))",
    marginTop: "6px",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    background: "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
    borderBottom: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))",
    fontSize: "12px",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
  };

  const contentAreaStyle: React.CSSProperties = {
    maxHeight: "400px",
    overflowY: "auto",
    background: "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
  };

  if (!content) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ color: "var(--vscode-editor-foreground)", fontWeight: 600, opacity: 0.9 }}>
            {basename}
          </span>
          <span style={badgeStyle}>{isCreate ? "CREATE" : "REWRITE"}</span>
        </div>
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            color: "var(--vscode-descriptionForeground)",
            fontSize: "12px",
            fontStyle: "italic",
            background: "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
          }}
        >
          Empty file
        </div>
      </div>
    );
  }

  const visibleLines = lines.slice(0, visibleCount);
  const isAnimating = visibleCount < lineCount;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span
          style={{
            color: "var(--vscode-editor-foreground)",
            fontWeight: 600,
            opacity: 0.9,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {basename}
        </span>
        <span
          style={{
            color: "var(--vscode-descriptionForeground)",
            fontSize: "11px",
            opacity: 0.7,
            whiteSpace: "nowrap",
          }}
        >
          {isAnimating ? `${visibleCount} / ${lineCount}` : `${lineCount}`}{" "}
          {lineCount === 1 ? "line" : "lines"}
        </span>
        <span style={badgeStyle}>{isCreate ? "CREATE" : "REWRITE"}</span>
      </div>

      {/* Plain-text content area — no syntax highlighting, fast typewriter scroll */}
      <div ref={contentAreaRef} style={contentAreaStyle}>
        <pre
          style={{
            margin: 0,
            padding: "6px 0",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "12px",
            lineHeight: "1.5",
            color: "var(--vscode-editor-foreground)",
            whiteSpace: "pre",
            overflowX: "auto",
          }}
        >
          {visibleLines.map((line, idx) => (
            <div
              key={idx}
              style={{ display: "flex", minHeight: "1.5em" }}
            >
              {/* Line number gutter */}
              <span
                style={{
                  width: "40px",
                  minWidth: "40px",
                  textAlign: "right",
                  paddingRight: "12px",
                  paddingLeft: "8px",
                  color: "var(--vscode-editorLineNumber-foreground, rgba(255,255,255,0.3))",
                  userSelect: "none",
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              {/* Plain text line — no highlighting */}
              <span style={{ paddingLeft: "4px", paddingRight: "16px" }}>
                {line}
              </span>
            </div>
          ))}
          {/* Blinking cursor while animating */}
          {isAnimating && (
            <div style={{ display: "flex", minHeight: "1.5em" }}>
              <span
                style={{
                  width: "40px",
                  minWidth: "40px",
                  paddingRight: "12px",
                  paddingLeft: "8px",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  paddingLeft: "4px",
                  display: "inline-block",
                  width: "7px",
                  height: "14px",
                  background: "var(--vscode-editor-foreground)",
                  opacity: 0.8,
                  animation: "zen-cursor-blink 0.6s step-end infinite",
                  verticalAlign: "middle",
                }}
              />
            </div>
          )}
        </pre>
      </div>

      {/* Cursor blink keyframes injected once */}
      <style>{`
        @keyframes zen-cursor-blink {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default FullContentView;
