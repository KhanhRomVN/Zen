import { findClosingTagPosition } from '../../utils/TagClosingFinder';
import { getExecutableToolTypes } from '../../constants/tool-registry';

/**
 * Thinking content is extracted from the tag content.
 * The thinking blocks are pre-extracted by extractThinkingBlocks
 * and replaced with placeholders. This parser handles the placeholders.
 */
export const parseThinking = (innerContent: string): string => {
  return innerContent.trim();
};

export interface ThinkingExtractResult {
  remainingContent: string;
  thinkingBlocks: string[];
  unclosedThinkingContent: string | null;
}

/**
 * Pre-extract all <thinking> blocks from content before any tool scanning,
 * so that tool tags inside a thinking block are never mistaken for real calls.
 *
 * CRITICAL FIX: Only extract TOP-LEVEL <thinking> blocks (not nested inside tool tags).
 * This prevents false-positives when <thinking> appears as literal text inside
 * tool content (e.g., inside <content> of <write_to_file>).
 *
 * ADDITIONAL FIX: Skip <thinking> tags inside backticks (inline code or code blocks).
 *
 * Closed blocks are replaced with numbered placeholders __THINKING_N__ and
 * their content stored in thinkingBlocks[].  An unclosed trailing <thinking>
 * (streaming case) is removed from content and returned separately.
 */
export const extractThinkingBlocks = (
  content: string,
): ThinkingExtractResult => {
  const thinkingBlocks: string[] = [];
  
  // Debug flag
  const DEBUG_THINKING = 
    typeof window !== "undefined" &&
    window.localStorage?.getItem("zen_debug_parser") === "true";
  
  if (DEBUG_THINKING) {
    console.log("[Zen][ThinkingParser] 📥 Input:", {
      length: content.length,
      preview: content.substring(0, 100),
    });
  }
  
  // Tool tags that should NOT have their content scanned for thinking blocks
  // Use EXECUTABLE tools only (excludes UI category: markdown, question, code, thinking)
  // These are real tool calls that might contain literal <thinking> in their content
  const toolTags = [
    ...getExecutableToolTypes().filter(t => t !== 'thinking'), 
    'file', // Special display tag not in registry
  ];
  
  if (DEBUG_THINKING) {
    console.log("[Zen][ThinkingParser] 🔧 Tool tags to skip:", toolTags);
  }

  // Build processed content manually by scanning through
  let processed = '';
  let i = 0;
  let inBacktick = false; // Track if we're inside backticks
  let backtickCount = 0;  // Track single (`) vs triple (```) backticks
  
  while (i < content.length) {
    // Check for backticks (both single ` and triple ```)
    if (content[i] === '`') {
      // Count consecutive backticks
      let currentBacktickCount = 0;
      let j = i;
      while (j < content.length && content[j] === '`') {
        currentBacktickCount++;
        j++;
      }
      
      // Toggle backtick state if matching pair
      if (inBacktick && currentBacktickCount === backtickCount) {
        // Closing backtick
        inBacktick = false;
        backtickCount = 0;
      } else if (!inBacktick) {
        // Opening backtick
        inBacktick = true;
        backtickCount = currentBacktickCount;
      }
      
      // Copy backticks to output
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
      if (content.substring(i, i + openTag.length).toLowerCase() === openTag.toLowerCase()) {
        // Must be followed by > or space or / (not part of a longer tag name)
        const nextChar = content[i + openTag.length];
        if (nextChar !== '>' && nextChar !== ' ' && nextChar !== '/') {
          // This is part of a longer tag name (e.g., <thinking> vs <think>), skip
          continue;
        }
        
        // Find the closing tag for this tool
        const closingTag = `</${toolTag}>`;
        const closingIndex = content.toLowerCase().indexOf(closingTag.toLowerCase(), i);
        
        if (closingIndex !== -1) {
          // Copy entire tool block as-is (including any nested <thinking> as literal text)
          const toolBlock = content.substring(i, closingIndex + closingTag.length);
          processed += toolBlock;
          i = closingIndex + closingTag.length;
          foundToolTag = true;
          break;
        } else {
          // Tool tag not closed - this might be streaming, stop here
          // Don't process <thinking> in unclosed tool content
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
    const thinkingOpenTag = '<thinking>';
    
    if (content.substring(i, i + thinkingOpenTag.length).toLowerCase() === thinkingOpenTag.toLowerCase()) {
      let thinkingEndIndex = findClosingTagPosition(content, i + thinkingOpenTag.length, '</thinking>');
      
      // Fallback: if backtick-aware search failed but </thinking> exists, use simple search
      if (thinkingEndIndex === -1) {
        const simpleEndIndex = content.toLowerCase().indexOf('</thinking>', i + thinkingOpenTag.length);
        if (simpleEndIndex !== -1) {
          if (DEBUG_THINKING) {
            console.warn("[Zen][ThinkingParser] Fallback to simple indexOf for </thinking>");
          }
          thinkingEndIndex = simpleEndIndex;
        }
      }
      
      if (thinkingEndIndex !== -1) {
        // Found complete thinking block
        const thinkingContent = content.substring(i + thinkingOpenTag.length, thinkingEndIndex);
        const idx = thinkingBlocks.length;
        thinkingBlocks.push(thinkingContent);
        processed += `__THINKING_${idx}__`;
        i = thinkingEndIndex + '</thinking>'.length;
        
        if (DEBUG_THINKING) {
          console.log("[Zen][ThinkingParser] ✅ Extracted thinking block:", {
            index: idx,
            contentLength: thinkingContent.length,
          });
        }
        continue;
      } else {
        // Unclosed thinking at the end (streaming case)
        const unclosedContent = content.substring(i + thinkingOpenTag.length);
        
        if (DEBUG_THINKING) {
          console.log("[Zen][ThinkingParser] ⏳ Unclosed thinking at end:", {
            unclosedLength: unclosedContent.length,
          });
        }
        
        return {
          remainingContent: processed,
          thinkingBlocks,
          unclosedThinkingContent: unclosedContent
        };
      }
    }
    
    // Check for partial <thinking tag at the very end (streaming incomplete opening tag)
    // e.g., "<thi", "<think", "<thinking" without the closing >
    const remainingContent = content.substring(i);
    const partialThinkingMatch = remainingContent.match(/^<thinking?$/i);
    if (partialThinkingMatch && i + remainingContent.length === content.length) {
      // This is a partial opening tag at the end - don't include it
      // It will be completed in the next streaming chunk
      
      if (DEBUG_THINKING) {
        console.log("[Zen][ThinkingParser] 🔖 Partial thinking tag at end:", {
          partial: partialThinkingMatch[0],
        });
      }
      
      return {
        remainingContent: processed,
        thinkingBlocks,
        unclosedThinkingContent: null
      };
    }
    
    // Regular character, just copy it
    processed += content[i];
    i++;
  }

  if (DEBUG_THINKING) {
    console.log("[Zen][ThinkingParser] 📤 Output:", {
      thinkingBlocks: thinkingBlocks.length,
      remainingLength: processed.length,
      remainingPreview: processed.substring(0, 100),
    });
  }

  return {
    remainingContent: processed,
    thinkingBlocks,
    unclosedThinkingContent: null
  };
};