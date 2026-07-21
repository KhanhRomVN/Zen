import React from "react";

// COMPONENTS
import MarkdownBlock from "../blocks/markdown/MarkdownBlock";

interface MarkdownRendererProps {
  content: string;
  knownFilePaths?: Map<string, string>;
  className?: string;
}

/**
 * Renderer for markdown content blocks
 * Wraps MarkdownBlock with standard styling
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  knownFilePaths,
  className,
}) => {
  return (
    <div
      style={{
        paddingTop: "4px",
        fontSize: "var(--font-size-sm)",
        color: "var(--primary-text)",
      }}
    >
      <MarkdownBlock
        content={content}
        knownFilePaths={knownFilePaths}
        className={className}
      />
    </div>
  );
};
