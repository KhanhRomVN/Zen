/**
 * Find the position of a closing tag while respecting backtick, comment, and string contexts.
 * This ensures that closing tags inside code blocks, comments, or strings are not mistakenly
 * detected as actual closing tags.
 * 
 * @param content The full content string to search in
 * @param startPos The position to start searching from (after the opening tag)
 * @param closingTag The closing tag to search for (e.g., "</thinking>", "</write_to_file>")
 * @returns The position of the real closing tag, or -1 if not found
 */
export function findClosingTagPosition(
  content: string,
  startPos: number,
  closingTag: string,
): number {
  let scanPos = startPos;
  
  // Stack to track open backtick contexts
  const backtickStack: number[] = [];
  
  // Track if we're in a comment or string
  let inLineComment = false;
  let inBlockComment = false;
  let inHtmlComment = false;
  let inSingleQuoteString = false;
  let inDoubleQuoteString = false;
  
  while (scanPos < content.length) {
    const char = content[scanPos];
    const prevChar = scanPos > 0 ? content[scanPos - 1] : '';
    const nextChar = scanPos < content.length - 1 ? content[scanPos + 1] : '';
    
    // Check if current character is escaped
    const isEscaped = prevChar === '\\';
    
    // Handle line comment end (newline)
    if (inLineComment && char === '\n') {
      inLineComment = false;
      scanPos++;
      continue;
    }
    
    // Handle block comment end
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      scanPos += 2;
      continue;
    }
    
    // Handle HTML comment end
    if (inHtmlComment && char === '-' && content.substring(scanPos, scanPos + 3) === '-->') {
      inHtmlComment = false;
      scanPos += 3;
      continue;
    }
    
    // If we're in any comment, skip everything
    if (inLineComment || inBlockComment || inHtmlComment) {
      scanPos++;
      continue;
    }
    
    // Handle string contexts (only when not in comment)
    if (inSingleQuoteString) {
      if (char === "'" && !isEscaped) {
        inSingleQuoteString = false;
      }
      scanPos++;
      continue;
    }
    
    if (inDoubleQuoteString) {
      if (char === '"' && !isEscaped) {
        inDoubleQuoteString = false;
      }
      scanPos++;
      continue;
    }
    
    // Check for comment starts (only when not in string or backtick)
    if (backtickStack.length === 0) {
      // Line comment
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        scanPos += 2;
        continue;
      }
      
      // Block comment
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        scanPos += 2;
        continue;
      }
      
      // HTML comment
      if (char === '<' && content.substring(scanPos, scanPos + 4) === '<!--') {
        inHtmlComment = true;
        scanPos += 4;
        continue;
      }
      
      // String start
      if (char === "'" && !isEscaped) {
        inSingleQuoteString = true;
        scanPos++;
        continue;
      }
      
      if (char === '"' && !isEscaped) {
        inDoubleQuoteString = true;
        scanPos++;
        continue;
      }
    }
    
    // Skip escaped backticks
    if (isEscaped && char === '`') {
      scanPos++;
      continue;
    }
    
    // Check for backtick sequences (only when not in string or comment)
    if (char === '`') {
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
    
    // Only check for closing tag when NOT in any special context
    if (
      backtickStack.length === 0 &&
      !inLineComment &&
      !inBlockComment &&
      !inHtmlComment &&
      !inSingleQuoteString &&
      !inDoubleQuoteString
    ) {
      if (content.substring(scanPos, scanPos + closingTag.length).toLowerCase() === closingTag.toLowerCase()) {
        return scanPos;
      }
    }
    
    scanPos++;
  }
  
  return -1; // Not found
}
