import React from "react";
import { Cpu } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * ThinkingBlock displays AI thinking/reasoning content.
 * - Collapsed by default: Shows only "Sparkle Thinking for Xs"
 * - Auto-expands during streaming
 * - Click to toggle expand/collapse
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isStreaming = false,
}) => {
  const [isManuallyExpanded, setIsManuallyExpanded] = React.useState(false);

  const isExpanded = isStreaming || isManuallyExpanded;

  // Parse content: remove <thinking> tags and extract elapsed time
  const { cleanContent, elapsedTime } = React.useMemo(() => {
    let cleaned = content
      .replace(/<thinking>/gi, "")
      .replace(/<\/thinking>/gi, "");

    // Extract elapsed time from XML tag (new format)
    let elapsedMatch = cleaned.match(
      /<thinking_elapsed>([\d.]+)<\/thinking_elapsed>/i,
    );
    let elapsed = elapsedMatch ? parseFloat(elapsedMatch[1]) : null;

    // Fallback: Try old HTML comment format
    if (!elapsed) {
      elapsedMatch = cleaned.match(
        /<!--\s*thinking_elapsed:\s*([\d.]+)s\s*-->/,
      );
      elapsed = elapsedMatch ? parseFloat(elapsedMatch[1]) : null;
    }

    // Remove metadata (both XML tags and HTML comments)
    cleaned = cleaned
      .replace(/<thinking_elapsed>.*?<\/thinking_elapsed>/gi, "")
      .replace(/<!--.*?-->/gs, "")
      .trim();

    return { cleanContent: cleaned, elapsedTime: elapsed };
  }, [content]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isStreaming) {
      setIsManuallyExpanded(!isManuallyExpanded);
    }
  };

  const thinkingLabel = elapsedTime
    ? `Thinking for ${elapsedTime}s`
    : "Thinking";

  return (
    <div
      style={{
        marginTop: "4px",
        marginBottom: "4px",
      }}
    >
      {/* Header - Always visible */}
      <div
        onClick={handleToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0",
          cursor: isStreaming ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        <span
          style={{
            color: "var(--vscode-textLink-activeForeground, #0098ff)",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Cpu size={14} />
        </span>

        <span
          style={{
            flex: 1,
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--vscode-descriptionForeground, #999)",
            letterSpacing: "0.3px",
          }}
        >
          {thinkingLabel}
          {isStreaming && (
            <span
              style={{
                marginLeft: "8px",
                fontSize: "10px",
                fontWeight: 400,
                fontStyle: "italic",
              }}
            >
              (streaming...)
            </span>
          )}
        </span>
      </div>

      {/* Content - Show when expanded */}
      {isExpanded && cleanContent && (
        <div
          style={{
            marginTop: "8px",
            paddingLeft: "22px",
            fontSize: "12px",
            lineHeight: 1.6,
            color: "var(--vscode-descriptionForeground, #999)",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {cleanContent}
        </div>
      )}

      {/* Empty state when no content yet */}
      {isExpanded && !cleanContent && (
        <div
          style={{
            marginTop: "8px",
            paddingLeft: "22px",
            fontSize: "11px",
            color: "var(--vscode-descriptionForeground, #999)",
            fontStyle: "italic",
          }}
        >
          Thinking...
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;
