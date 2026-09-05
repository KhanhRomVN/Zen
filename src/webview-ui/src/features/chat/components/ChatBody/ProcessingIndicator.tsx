import React, { useEffect, useRef } from "react";
import { useStreamingPreviewStore } from "../../stores/streamingPreviewStore";
import { useShallow } from "zustand/react/shallow";

interface ProcessingIndicatorProps {
  /** true = dang cho response hoac dang streaming */
  isResponding?: boolean;
  // 🔧 Removed streamingContent prop - now using Zustand store for performance
}

const MAX_PREVIEW_LINES = 5;

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  isResponding,
}) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // 🔧 FIX: Use useShallow to prevent infinite re-renders
  const { content: streamingContent } = useStreamingPreviewStore(
    useShallow((state) => ({
      content: state.content,
    }))
  );

  // 🔧 Auto-scroll to bottom when content changes (using ref to avoid re-render)
  useEffect(() => {
    if (previewContainerRef.current && streamingContent) {
      // Use RAF to batch DOM mutations (performance best practice from doc)
      requestAnimationFrame(() => {
        if (previewContainerRef.current) {
          previewContainerRef.current.scrollTop = previewContainerRef.current.scrollHeight;
        }
      });
    }
  }, [streamingContent]);

  if (!isResponding) {
    return null;
  }

  // 🔧 Extract LAST N lines for preview (show most recent streaming text)
  const lines = streamingContent.split('\n');
  const previewText = lines
    .slice(Math.max(0, lines.length - MAX_PREVIEW_LINES))
    .join('\n');

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: "-var(--spacing-sm)",
        marginBottom: "var(--spacing-md)",
      }}
    >
      {/* 🔧 Streaming content preview - max 5 lines, auto-scroll, hidden scrollbar */}
      {previewText && (
        <div
          ref={previewContainerRef}
          style={{
            maxHeight: `calc(var(--font-size-md) * 1.5 * ${MAX_PREVIEW_LINES})`, // 5 lines height
            overflowY: "auto",
            color: "var(--vscode-editor-foreground)",
            opacity: 0.6,
            fontSize: "var(--font-size-md)",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            // Hide scrollbar
            scrollbarWidth: "none", // Firefox
            msOverflowStyle: "none", // IE/Edge
          }}
          className="streaming-preview"
        >
          {previewText}
        </div>
      )}

      <style>
        {`
        /* Hide scrollbar for WebKit browsers (Chrome, Safari) */
        .streaming-preview::-webkit-scrollbar {
          display: none;
        }
      `}
      </style>
    </div>
  );
};

export default ProcessingIndicator;
