import React, { useEffect, useMemo, useRef } from "react";
import { useStreamingPreviewStore } from "../../stores/streamingPreviewStore";
import { useShowThinkingStore } from "../../stores/showThinkingStore";
import { parseThinking } from "../../services/parsers/ThinkingParser";
import { ThinkingBlock } from "./AIMessageBox/blocks/thinking/ThinkingBlock";
import { useShallow } from "zustand/react/shallow";

interface ProcessingIndicatorProps {
  /** true = dang cho response hoac dang streaming */
  isResponding?: boolean;
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

  const showThinking = useShowThinkingStore((s) => s.isVisible);

  // Parse thinking from streaming content (supports single opening tag <thinking> / <think>)
  const { thinkingBlock, previewText } = useMemo(() => {
    if (!streamingContent || !streamingContent.trim()) {
      return { thinkingBlock: null, previewText: "" };
    }

    const { thinkingBlocks, remainingContent } = parseThinking(streamingContent);
    const firstThinking = thinkingBlocks.length > 0 ? thinkingBlocks[0] : null;

    // Filter out __THINKING_N__ placeholders from remaining content
    const cleanRemaining = remainingContent.replace(/__THINKING_\d+__/g, "").trim();

    let textForPreview = "";
    if (cleanRemaining) {
      const lines = cleanRemaining.split("\n");
      textForPreview = lines
        .slice(Math.max(0, lines.length - MAX_PREVIEW_LINES))
        .join("\n");
    } else if (!firstThinking) {
      // If no thinking tag at all, preview raw streaming content
      const lines = streamingContent.split("\n");
      textForPreview = lines
        .slice(Math.max(0, lines.length - MAX_PREVIEW_LINES))
        .join("\n");
    }

    return {
      thinkingBlock: firstThinking,
      previewText: textForPreview,
    };
  }, [streamingContent]);

  // 🔧 Auto-scroll to bottom when content changes (using ref to avoid re-render)
  useEffect(() => {
    if (previewContainerRef.current && previewText) {
      requestAnimationFrame(() => {
        if (previewContainerRef.current) {
          previewContainerRef.current.scrollTop = previewContainerRef.current.scrollHeight;
        }
      });
    }
  }, [previewText]);

  if (!isResponding) {
    return null;
  }

  // Consistent blockKey based on thinking content slice so that elapsed duration persists into AIMessageBox
  const thinkingKey = thinkingBlock?.content
    ? `content-${thinkingBlock.content.slice(0, 40).replace(/\s+/g, "_")}`
    : "streaming-thinking-block";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: "-var(--spacing-sm)",
        marginBottom: "var(--spacing-md)",
      }}
    >
      {/* 🧠 Live ThinkingBlock during streaming (renders as soon as opening <thinking> or <think> appears) */}
      {showThinking && thinkingBlock && (
        <ThinkingBlock
          content={thinkingBlock.content}
          isStreaming={!thinkingBlock.isClosed}
          isClosed={thinkingBlock.isClosed}
          blockKey={thinkingKey}
        />
      )}

      {/* 🔧 Streaming content preview for text following thinking */}
      {previewText && (
        <div
          ref={previewContainerRef}
          style={{
            maxHeight: `calc(var(--font-size-md) * 1.5 * ${MAX_PREVIEW_LINES})`,
            overflowY: "auto",
            color: "var(--vscode-editor-foreground)",
            opacity: 0.6,
            fontSize: "var(--font-size-md)",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          className="streaming-preview"
        >
          {previewText}
        </div>
      )}

      <style>
        {`
        .streaming-preview::-webkit-scrollbar {
          display: none;
        }
      `}
      </style>
    </div>
  );
};

export default ProcessingIndicator;
