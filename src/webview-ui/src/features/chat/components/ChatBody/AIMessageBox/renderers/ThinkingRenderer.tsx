import React, { useRef, useEffect, useState, useMemo } from "react";

interface ThinkingRendererProps {
  content: string;
  maxHeight?: number | string;
  isStreaming?: boolean;
}

/**
 * ThinkingRenderer displays AI thinking/reasoning content with virtual scrolling
 * for performance optimization. It's a standalone component used in ChatBody
 * to render thinking blocks independently from AI message boxes.
 */
export const ThinkingRenderer: React.FC<ThinkingRendererProps> = ({
  content,
  maxHeight = 240,
  isStreaming = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Virtual scrolling configuration
  const LINE_HEIGHT = 18; // 12px font * 1.5 line-height
  const BUFFER_SIZE = 5; // Extra lines above and below viewport
  const maxHeightPx = typeof maxHeight === "number" ? maxHeight : 240;

  // Split content into lines
  const lines = useMemo(() => content.split("\n"), [content]);
  const totalLines = lines.length;

  // Calculate visible range with virtual scrolling
  const { visibleLines, offsetY } = useMemo(() => {
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

  // Auto-scroll to bottom when streaming NEW content
  useEffect(() => {
    if (isStreaming && containerRef.current && !isUserScrolling) {
      // Smooth scroll to bottom
      const maxScroll = Math.max(0, totalLines * LINE_HEIGHT - maxHeightPx);
      containerRef.current.scrollTop = maxScroll;
    }
  }, [content, isStreaming, totalLines, maxHeightPx, isUserScrolling]);

  // Handle scroll event - detect user manual scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    setScrollTop(newScrollTop);

    // Detect if user is manually scrolling up (away from bottom)
    const maxScroll = Math.max(0, totalLines * LINE_HEIGHT - maxHeightPx);
    const isNearBottom = maxScroll - newScrollTop < 50; // Within 50px of bottom

    if (!isNearBottom) {
      setIsUserScrolling(true);

      // Clear existing timeout
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }

      // Resume auto-scroll after 2 seconds of no scrolling
      autoScrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 2000);
    } else {
      setIsUserScrolling(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, []);

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
          overflowY:
            totalLines * LINE_HEIGHT > maxHeightPx ? "auto" : "hidden",
          padding: 0,
          border: "none",
          background: "transparent",
          outline: "none",
          flex: 1,
          position: "relative",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Spacer to maintain scroll height */}
        <div
          style={{
            height: `${totalLines * LINE_HEIGHT}px`,
            position: "relative",
          }}
        >
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

        {/* Inline styles for hiding scrollbar */}
        <style>{`
          div[style*="scrollbar-width: none"]::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default ThinkingRenderer;
