export interface ThinkingExtractResult {
  remainingContent: string;
  thinkingBlocks: string[];
  unclosedThinkingContent: string | null;
}

/**
 * Pre-extract all <thinking> blocks from content before any tool scanning,
 * so that tool tags inside a thinking block are never mistaken for real calls.
 *
 * Closed blocks are replaced with numbered placeholders __THINKING_N__ and
 * their content stored in thinkingBlocks[].  An unclosed trailing <thinking>
 * (streaming case) is removed from content and returned separately.
 */
export const extractThinkingBlocks = (
  content: string,
): ThinkingExtractResult => {
  const thinkingBlocks: string[] = [];
  let remainingContent = content;

  // 1. Closed <thinking>...</thinking> blocks
  remainingContent = remainingContent.replace(
    /<thinking>([\s\S]*?)<\/thinking>/gi,
    (_match, inner) => {
      const idx = thinkingBlocks.length;
      thinkingBlocks.push(inner);
      return `__THINKING_${idx}__`;
    },
  );

  // 2. Unclosed <thinking> (streaming — tail of content)
  const unclosedThinkingMatch = /<thinking>([\s\S]*)$/i.exec(remainingContent);
  let unclosedThinkingContent: string | null = null;
  if (unclosedThinkingMatch) {
    unclosedThinkingContent = unclosedThinkingMatch[1];
    remainingContent = remainingContent.substring(
      0,
      unclosedThinkingMatch.index,
    );
  }

  return { remainingContent, thinkingBlocks, unclosedThinkingContent };
};
