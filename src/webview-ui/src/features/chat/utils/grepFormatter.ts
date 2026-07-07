// src/webview-ui/src/features/chat/utils/grepFormatter.ts

export interface GrepResultData {
  searchTerm: string;
  results: Record<
    string,
    | { lineNumber: number; lineContent: string }[]
    | {
        matches: { lineNumber: number; lineContent: string }[];
        errorCount: number;
        warningCount: number;
      }
  >;
  totalFilesSearched: number;
  totalMatches: number;
}

/**
 * Format grep result data as compact XML-like text to minimize LLM token usage.
 * Instead of JSON (with braces, quotes, commas), uses a structured tag format.
 *
 * Example output:
 * <grep_results search="foo" total_matches="12" files="3">
 * <file path="src/a.ts" matches="2" errors="1" warnings="2">
 *   3: const foo = 1
 *  17: foo.init()
 * </file>
 * </grep_results>
 */
export const formatGrepResultCompact = (data: GrepResultData): string => {
  const { searchTerm, results, totalFilesSearched, totalMatches } = data;
  const filePaths = Object.keys(results);
  const fileCount = filePaths.length;

  if (totalMatches === 0) {
    return `<grep_results search="${searchTerm}" total_matches="0" files_searched="${totalFilesSearched}" />\n`;
  }

  const lines: string[] = [];
  lines.push(
    `<grep_results search="${searchTerm}" total_matches="${totalMatches}" files="${fileCount}" files_searched="${totalFilesSearched}">`,
  );

  for (const filePath of filePaths) {
    const fileResult = results[filePath];
    
    // Handle both old format (array) and new format (object with matches + diagnostics)
    let matches: { lineNumber: number; lineContent: string }[];
    let errorCount = 0;
    let warningCount = 0;
    
    if (Array.isArray(fileResult)) {
      // Old format: array of matches
      matches = fileResult;
    } else {
      // New format: object with matches and diagnostic counts
      matches = fileResult.matches;
      errorCount = fileResult.errorCount;
      warningCount = fileResult.warningCount;
    }
    
    // Build file tag attributes
    let fileTag = `<file path="${filePath}" matches="${matches.length}"`;
    if (errorCount > 0 || warningCount > 0) {
      if (errorCount > 0) {
        fileTag += ` errors="${errorCount}"`;
      }
      if (warningCount > 0) {
        fileTag += ` warnings="${warningCount}"`;
      }
    }
    fileTag += `>`;
    
    lines.push(fileTag);
    
    for (const match of matches) {
      // Right-align line number in 5 chars, then content (trimmed to 120 chars)
      const lineNum = String(match.lineNumber).padStart(5);
      const content =
        match.lineContent.length > 120
          ? match.lineContent.slice(0, 117) + "..."
          : match.lineContent;
      lines.push(`${lineNum}: ${content}`);
    }
    lines.push(`</file>`);
  }

  lines.push(`</grep_results>`);
  return lines.join("\n");
};
