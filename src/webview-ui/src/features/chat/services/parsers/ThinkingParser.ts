import { findClosingTagPosition } from "../../utils/TagClosingFinder";
import { getAllToolTypes } from "../../constants/constants";

export interface ThinkingBlockItem {
  content: string;
  isClosed: boolean;
}

export interface ThinkingExtractResult {
  remainingContent: string;
  thinkingBlocks: ThinkingBlockItem[];
}

/**
 * Pre-extract all <thinking> and <think> blocks from content before any tool scanning,
 * so that tool tags inside a thinking block are never mistaken for real calls.
 *
 * CRITICAL FIX: Supports BOTH closed (<thinking>...</thinking>, <think>...</think>)
 * AND unclosed (single tag during streaming: <thinking>... or <think>...).
 * This ensures the UI immediately displays the thinking process as soon as the opening
 * tag is emitted by the AI stream.
 *
 * Only extracts TOP-LEVEL thinking blocks (not nested inside tool tags, not inside backticks).
 */
export const parseThinking = (content: string): ThinkingExtractResult => {
  const thinkingBlocks: ThinkingBlockItem[] = [];

  // Tool tags that should NOT have their content scanned for thinking blocks
  const toolTags = [
    ...getAllToolTypes().filter((t: string) => t !== "thinking"),
    "file", // Special display tag not in registry
  ];

  // Helper to find next tool tag start after index
  const findNextToolTagStart = (startPos: number): number => {
    let earliest = -1;
    for (const toolTag of toolTags) {
      const openTag = `<${toolTag}`;
      const pos = content.toLowerCase().indexOf(openTag.toLowerCase(), startPos);
      if (pos !== -1) {
        const nextChar = content[pos + openTag.length];
        if (nextChar === ">" || nextChar === " " || nextChar === "/") {
          if (earliest === -1 || pos < earliest) {
            earliest = pos;
          }
        }
      }
    }
    return earliest;
  };

  // Build processed content manually by scanning through
  let processed = "";
  let i = 0;
  let inBacktick = false; // Track if we're inside backticks
  let backtickCount = 0; // Track single (`) vs triple (```) backticks

  while (i < content.length) {
    // Check for backticks (both single ` and triple ```)
    if (content[i] === "`") {
      let currentBacktickCount = 0;
      let j = i;
      while (j < content.length && content[j] === "`") {
        currentBacktickCount++;
        j++;
      }

      // Toggle backtick state if matching pair
      if (inBacktick && currentBacktickCount === backtickCount) {
        inBacktick = false;
        backtickCount = 0;
      } else if (!inBacktick) {
        inBacktick = true;
        backtickCount = currentBacktickCount;
      }

      processed += content.substring(i, j);
      i = j;
      continue;
    }

    // Skip thinking/tool parsing if inside backticks
    if (inBacktick) {
      processed += content[i];
      i++;
      continue;
    }

    // Check if we're at the start of a tool tag
    let foundToolTag = false;
    for (const toolTag of toolTags) {
      const openTag = `<${toolTag}`;
      if (
        content.substring(i, i + openTag.length).toLowerCase() ===
        openTag.toLowerCase()
      ) {
        const nextChar = content[i + openTag.length];
        if (nextChar !== ">" && nextChar !== " " && nextChar !== "/") {
          continue;
        }

        const closingTag = `</${toolTag}>`;
        const closingIndex = content
          .toLowerCase()
          .indexOf(closingTag.toLowerCase(), i);

        if (closingIndex !== -1) {
          const toolBlock = content.substring(
            i,
            closingIndex + closingTag.length,
          );
          processed += toolBlock;
          i = closingIndex + closingTag.length;
          foundToolTag = true;
          break;
        } else {
          processed += content.substring(i);
          i = content.length;
          foundToolTag = true;
          break;
        }
      }
    }

    if (foundToolTag) {
      continue;
    }

    // Check for <thinking> tag at current position (only at top-level)
    const thinkingOpenRegex = /^<thinking(?:\s+[^>]*)?>/i;
    const thinkingMatch = thinkingOpenRegex.exec(content.substring(i));

    if (thinkingMatch) {
      const openTagStr = thinkingMatch[0];
      const contentStart = i + openTagStr.length;
      let thinkingEndIndex = findClosingTagPosition(
        content,
        contentStart,
        "</thinking>",
      );

      // Fallback: if backtick-aware search failed but </thinking> exists, use simple search
      if (thinkingEndIndex === -1) {
        const simpleEndIndex = content
          .toLowerCase()
          .indexOf("</thinking>", contentStart);
        if (simpleEndIndex !== -1) {
          thinkingEndIndex = simpleEndIndex;
        }
      }

      if (thinkingEndIndex !== -1) {
        // Found complete thinking block
        const thinkingContent = content.substring(
          contentStart,
          thinkingEndIndex,
        );
        const idx = thinkingBlocks.length;
        thinkingBlocks.push({ content: thinkingContent, isClosed: true });
        processed += `__THINKING_${idx}__`;
        i = thinkingEndIndex + "</thinking>".length;
        continue;
      } else {
        // Only 1 tag exists (streaming or unclosed tag)
        const nextTagPos = findNextToolTagStart(contentStart);
        const thinkingContent =
          nextTagPos !== -1
            ? content.substring(contentStart, nextTagPos)
            : content.substring(contentStart);
        const idx = thinkingBlocks.length;
        thinkingBlocks.push({ content: thinkingContent, isClosed: false });
        processed += `__THINKING_${idx}__`;
        i = nextTagPos !== -1 ? nextTagPos : content.length;
        continue;
      }
    }

    // Check for <think> tag (short form, e.g. DeepSeek R1)
    const thinkOpenRegex = /^<think(?:\s*|\s+[^>]*)>/i;
    const thinkMatch = thinkOpenRegex.exec(content.substring(i));

    if (thinkMatch) {
      const openTagStr = thinkMatch[0];
      const contentStart = i + openTagStr.length;
      let thinkEndIndex = findClosingTagPosition(
        content,
        contentStart,
        "</think>",
      );

      // Fallback: simple search
      if (thinkEndIndex === -1) {
        const simpleEndIndex = content
          .toLowerCase()
          .indexOf("</think>", contentStart);
        if (simpleEndIndex !== -1) {
          thinkEndIndex = simpleEndIndex;
        }
      }

      if (thinkEndIndex !== -1) {
        // Found complete <think> block
        const thinkContent = content.substring(contentStart, thinkEndIndex);
        const idx = thinkingBlocks.length;
        thinkingBlocks.push({ content: thinkContent, isClosed: true });
        processed += `__THINKING_${idx}__`;
        i = thinkEndIndex + "</think>".length;
        continue;
      } else {
        // Only 1 tag exists (streaming or unclosed tag)
        const nextTagPos = findNextToolTagStart(contentStart);
        const thinkContent =
          nextTagPos !== -1
            ? content.substring(contentStart, nextTagPos)
            : content.substring(contentStart);
        const idx = thinkingBlocks.length;
        thinkingBlocks.push({ content: thinkContent, isClosed: false });
        processed += `__THINKING_${idx}__`;
        i = nextTagPos !== -1 ? nextTagPos : content.length;
        continue;
      }
    }

    // Regular character, just copy it
    processed += content[i];
    i++;
  }

  return {
    remainingContent: processed,
    thinkingBlocks,
  };
};
