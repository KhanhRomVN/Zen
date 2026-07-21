import React, { useRef, useEffect } from "react";
import "./FileStreamingBlock.css";

export interface FileStreamingBlockProps {
  content: string;
  maxHeight?: number | string;
  className?: string;
}

const FileStreamingBlock: React.FC<FileStreamingBlockProps> = ({
  content,
  maxHeight = 200,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever content changes (streaming)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`file-streaming-block ${className}`}
      style={{
        maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
      }}
    >
      <pre className="file-streaming-content">
        <code>{content}</code>
      </pre>
    </div>
  );
};

export default FileStreamingBlock;
