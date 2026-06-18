import React from "react";

interface FilePreviewBlockProps {
  content: string;
  isStreaming?: boolean;
  maxHeight?: number;
  className?: string;
}

/**
 * FilePreviewBlock - hiển thị nội dung file trong một block giống streaming preview
 * nhưng không có mask gradient và không có cursor nhấp nháy.
 * Dùng để preview file khi chờ approve.
 */
const FilePreviewBlock: React.FC<FilePreviewBlockProps> = ({
  content,
  isStreaming = false,
  maxHeight = 200,
  className,
}) => {
  if (!content) return null;

  return (
    <div
      className={className}
      style={{
        marginTop: "4px",
        padding: "6px 10px",
        background:
          "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
        borderRadius: "4px",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "11px",
        lineHeight: "1.5",
        color: "var(--vscode-editor-foreground)",
        whiteSpace: "pre",
        wordBreak: "break-all",
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        opacity: isStreaming ? 0.85 : 1,
        position: "relative",
        // Streaming mode: có mask gradient và cursor
        ...(isStreaming
          ? {
              maskImage: "linear-gradient(to bottom, transparent 0%, black 30%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 30%)",
            }
          : {}),
      }}
    >
      {content}
      {isStreaming && (
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "12px",
            background: "var(--vscode-editor-foreground)",
            marginLeft: "1px",
            verticalAlign: "middle",
            animation: "zen-cursor-blink 0.6s step-end infinite",
          }}
        />
      )}
      {isStreaming && (
        <style>{`
          @keyframes zen-cursor-blink {
            0%, 100% { opacity: 0.8; }
            50%       { opacity: 0; }
          }
        `}</style>
      )}
    </div>
  );
};

export default FilePreviewBlock;