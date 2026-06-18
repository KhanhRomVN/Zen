// src/webview-ui/src/features/chat/utils/grepFormatter.ts

export interface GrepResultData {
  searchTerm: string;
  results: Record<string, { lineNumber: number; lineContent: string }[]>;
  totalFilesSearched: number;
  totalMatches: number;
}

/**
 * Format grep result data as compact XML-like text to minimize LLM token usage.
 * Instead of JSON (with braces, quotes, commas), uses a structured tag format.
 *
 * Example output:
 * <grep_results search="foo" total_matches="12" files="3">
 * <file path="src/a.ts" matches="2">
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
    const matches = results[filePath];
    // Use full path for accurate file opening; display shortening is done in UI
    lines.push(`<file path="${filePath}" matches="${matches.length}">`);
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
