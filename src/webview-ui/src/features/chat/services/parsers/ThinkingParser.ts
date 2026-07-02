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
  
  // Tool tags that should NOT have their content scanned for thinking blocks
  const toolTags = [
    'write_to_file', 'replace_in_file', 'read_file', 'run_command',
    'list_files', 'delete_file', 'delete_folder', 'move_file',
    'execute_agent_action', 'grep', 'git_status', 'commit_message', 'git_diff',
    'code', 'file', 'markdown', 'question'
  ];

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
      // Find the REAL closing </thinking> tag (not inside backticks/code blocks)
      // Strategy: track all backtick sequences using a stack
      let thinkingEndIndex = -1;
      let scanPos = i + thinkingOpenTag.length;
      
      // Stack to track open backtick contexts
      const backtickStack: number[] = [];
      
      while (scanPos < content.length) {
        // Skip escaped backticks (\`)
        if (scanPos > 0 && content[scanPos - 1] === '\\' && content[scanPos] === '`') {
          scanPos++;
          continue;
        }
        
        // Check for backtick sequences
        if (content[scanPos] === '`') {
          let btCount = 0;
          let btPos = scanPos;
          while (btPos < content.length && content[btPos] === '`') {
            btCount++;
            btPos++;
          }
          
          // Try to close an existing backtick context with matching count
          let found = false;
          for (let si = backtickStack.length - 1; si >= 0; si--) {
            if (backtickStack[si] === btCount) {
              // Found matching close - remove from stack
              backtickStack.splice(si, 1);
              found = true;
              break;
            }
          }
          
          if (!found) {
            // Opening new backtick context
            backtickStack.push(btCount);
          }
          
          scanPos = btPos;
          continue;
        }
        
        // Only check for </thinking> when NO open backtick contexts
        if (backtickStack.length === 0) {
          const closingTag = '</thinking>';
          if (content.substring(scanPos, scanPos + closingTag.length).toLowerCase() === closingTag.toLowerCase()) {
            thinkingEndIndex = scanPos;
            break;
          }
        }
        
        scanPos++;
      }
      
      if (thinkingEndIndex !== -1) {
        // Found complete thinking block
        const thinkingContent = content.substring(i + thinkingOpenTag.length, thinkingEndIndex);
        const idx = thinkingBlocks.length;
        thinkingBlocks.push(thinkingContent);
        processed += `__THINKING_${idx}__`;
        i = thinkingEndIndex + '</thinking>'.length;
        continue;
      } else {
        // Unclosed thinking at the end (streaming case)
        const unclosedContent = content.substring(i + thinkingOpenTag.length);
        return {
          remainingContent: processed,
          thinkingBlocks,
          unclosedThinkingContent: unclosedContent
        };
      }
    }
    
    // Regular character, just copy it
    processed += content[i];
    i++;
  }

  return {
    remainingContent: processed,
    thinkingBlocks,
    unclosedThinkingContent: null
  };
};
