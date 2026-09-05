import React from "react";
import { ThinkingBlock } from "../blocks/thinking/ThinkingBlock";

interface ThinkingRendererProps {
  content: string;
  maxHeight?: number | string;
  isStreaming?: boolean;
  isClosed?: boolean;
  elapsedSeconds?: number;
  blockKey?: string;
}

/**
 * ThinkingRenderer wraps ThinkingBlock for use inside TagRouter.
 * Displays AI internal reasoning as a collapsible dark box that visually
 * distinguishes the thought process from the final answer.
 */
export const ThinkingRenderer: React.FC<ThinkingRendererProps> = ({
  content,
  maxHeight = 240,
  isStreaming = false,
  isClosed = true,
  elapsedSeconds,
  blockKey,
}) => {
  return (
    <ThinkingBlock
      content={content}
      maxHeight={maxHeight}
      isStreaming={isStreaming}
      isClosed={isClosed}
      elapsedSeconds={elapsedSeconds}
      blockKey={blockKey}
    />
  );
};

export default ThinkingRenderer;
