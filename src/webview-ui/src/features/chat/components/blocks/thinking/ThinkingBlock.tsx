import React, { useRef, useEffect, useState, useMemo } from "react";
import "./ThinkingBlock.css";

interface ThinkingRendererProps {
  content: string;
  maxHeight?: number | string;
  isStreaming?: boolean;
}

export const ThinkingRenderer: React.FC<ThinkingRendererProps> = ({
  content,
  maxHeight = 240,
  isStreaming = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Virtual scrolling configuration
  const LINE_HEIGHT = 18; // 12px font * 1.5 line-height
  const BUFFER_SIZE = 5; // Extra lines above and below viewport
  const maxHeightPx = typeof maxHeight === "number" ? maxHeight : 240;

  // Split content into lines
  const lines = useMemo(() => content.split("\n"), [content]);
  const totalLines = lines.length;

  // Calculate visible range with virtual scrolling
  const { startIndex, endIndex, visibleLines, offsetY } = useMemo(() => {
    const viewportLines = Math.ceil(maxHeightPx / LINE_HEIGHT);
    const scrollLines = Math.floor(scrollTop / LINE_HEIGHT);
    
    const start = Math.max(0, scrollLines - BUFFER_SIZE);
    const end = Math.min(totalLines, scrollLines + viewportLines + BUFFER_SIZE);
    
    return {
      startIndex: start,
      endIndex: end,
      visibleLines: lines.slice(start, end),
      offsetY: start * LINE_HEIGHT,
    };
  }, [scrollTop, lines, totalLines, maxHeightPx]);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      const maxScroll = Math.max(0, totalLines * LINE_HEIGHT - maxHeightPx);
      containerRef.current.scrollTop = maxScroll;
    }
  }, [content, isStreaming, totalLines, maxHeightPx]);

  // Handle scroll event
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "4px",
        paddingLeft: "12px",
      }}
    >
      {/* Virtual scrolling container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          fontFamily: "var(--vscode-editor-font-family, monospace)",
          fontSize: "12px",
          lineHeight: "1.5",
          color:
            "var(--vscode-descriptionForeground, var(--vscode-editor-foreground))",
          opacity: 0.75,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: `${maxHeightPx}px`,
          overflowY: totalLines * LINE_HEIGHT > maxHeightPx ? "auto" : "hidden",
          padding: 0,
          border: "none",
          background: "transparent",
          outline: "none",
          flex: 1,
          position: "relative",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        } as React.CSSProperties}
        className="thinking-block-scroll"
      >
        {/* Spacer to maintain scroll height */}
        <div style={{ height: `${totalLines * LINE_HEIGHT}px`, position: "relative" }}>
          {/* Visible content with offset */}
          <div
            style={{
              position: "absolute",
              top: `${offsetY}px`,
              left: 0,
              right: 0,
            }}
          >
            {visibleLines.join("\n")}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingRenderer;
