export interface DiffHighlight {
  startLine: number;
  endLine: number;
  type: "added" | "removed";
}

export interface DiffResult {
  code: string;
  lineHighlights: DiffHighlight[];
  stats: {
    added: number;
    removed: number;
  };
}

/**
 * Parses a diff string (SEARCH/REPLACE or Git-style) and returns content + highlights
 */
export const parseDiff = (diffText: string): DiffResult => {
  const lineHighlights: DiffHighlight[] = [];
  let codeContent = "";
  let added = 0;
  let removed = 0;

  // 1. Detect SEARCH/REPLACE format
  const searchPattern =
    /<<<<<<< SEARCH\s+([\s\S]*?)=======\s+([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/g;
  const matches = [...diffText.matchAll(searchPattern)];

  if (matches.length > 0) {
    matches.forEach((match, index) => {
      const searchBlock = match[1] || "";
      const replaceBlock = match[2] || "";

      const getLines = (text: string) =>
        text.replace(/\r?\n/g, "\n").trimEnd().split("\n");

      const searchLines = getLines(searchBlock);
      const replaceLines = getLines(replaceBlock);

      // Find common prefix/suffix within the block
      let prefixCount = 0;
      const minLen = Math.min(searchLines.length, replaceLines.length);
      while (
        prefixCount < minLen &&
        searchLines[prefixCount] === replaceLines[prefixCount]
      ) {
        prefixCount++;
      }

      let suffixCount = 0;
      const searchRemaining = searchLines.length - prefixCount;
      const replaceRemaining = replaceLines.length - prefixCount;
      const minRemaining = Math.min(searchRemaining, replaceRemaining);
      while (
        suffixCount < minRemaining &&
        searchLines[searchLines.length - 1 - suffixCount] ===
          replaceLines[replaceLines.length - 1 - suffixCount]
      ) {
        suffixCount++;
      }

      const prefixLines = searchLines.slice(0, prefixCount);
      const deletedLines = searchLines.slice(
        prefixCount,
        searchLines.length - suffixCount,
      );
      const addedLines = replaceLines.slice(
        prefixCount,
        replaceLines.length - suffixCount,
      );
      const suffixLines = searchLines.slice(searchLines.length - suffixCount);

      // Add separator for multiple blocks
      if (index > 0) {
        codeContent += "\n...\n";
      }

      const startLineOffset =
        codeContent === "" ? 1 : codeContent.split("\n").length + 1;
      const blockLines: string[] = [];

      prefixLines.forEach((l) => blockLines.push(l));

      const startDelete = startLineOffset + blockLines.length;
      deletedLines.forEach((l) => blockLines.push(l));
      const endDelete = startLineOffset + blockLines.length - 1;

      const startAdd = startLineOffset + blockLines.length;
      addedLines.forEach((l) => blockLines.push(l));
      const endAdd = startLineOffset + blockLines.length - 1;

      suffixLines.forEach((l) => blockLines.push(l));

      codeContent += blockLines.join("\n");

      if (deletedLines.length > 0) {
        lineHighlights.push({
          startLine: startDelete,
          endLine: endDelete,
          type: "removed",
        });
        removed += deletedLines.length;
      }
      if (addedLines.length > 0) {
        lineHighlights.push({
          startLine: startAdd,
          endLine: endAdd,
          type: "added",
        });
        added += addedLines.length;
      }
    });
    return { code: codeContent, lineHighlights, stats: { added, removed } };
  }

  // 1b. Detect PARTIAL SEARCH/REPLACE format (unclosed)
  const partialSearchPattern = /<<<<<<< SEARCH\s+([\s\S]*?)(?:=======|$)/g;
  const partialMatches = [...diffText.matchAll(partialSearchPattern)];
  if (partialMatches.length > 0) {
    const lastMatch = partialMatches[partialMatches.length - 1];
    const isActuallyUnclosed = !diffText.includes(">>>>>>> REPLACE");

    if (isActuallyUnclosed) {
      const searchBlock = lastMatch[1] || "";
      // If we have ======= but no REPLACE, we are streaming the replacement
      const replacementPart = diffText.split("=======").pop() || "";
      const hasSeparator = diffText.includes("=======");

      if (!hasSeparator) {
        // Just show the search block as "removed" (or just plain text for now)
        return {
          code: searchBlock,
          lineHighlights: [
            {
              startLine: 1,
              endLine: searchBlock.split("\n").length,
              type: "removed",
            },
          ],
          stats: { added: 0, removed: searchBlock.split("\n").length },
        };
      } else {
        // Show both search and replacement (as far as we have it)
        const searchLines = searchBlock.split("\n");
        const replaceLines = replacementPart.split("\n");

        const codeLines = [...searchLines, ...replaceLines];
        const searchCount = searchLines.length;

        return {
          code: codeLines.join("\n"),
          lineHighlights: [
            { startLine: 1, endLine: searchCount, type: "removed" },
            {
              startLine: searchCount + 1,
              endLine: codeLines.length,
              type: "added",
            },
          ],
          stats: { added: replaceLines.length, removed: searchLines.length },
        };
      }
    }
  }

  // 2. Detect Git-style diff format (basic check)
  if (
    diffText
      .split("\n")
      .some((line) => line.startsWith("+ ") || line.startsWith("- "))
  ) {
    const lines = diffText.split("\n");
    const resultLines: string[] = [];

    lines.forEach((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        resultLines.push(line.substring(1));
        const currentLineNum = resultLines.length;
        lineHighlights.push({
          startLine: currentLineNum,
          endLine: currentLineNum,
          type: "added",
        });
        added++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        resultLines.push(line.substring(1));
        const currentLineNum = resultLines.length;
        lineHighlights.push({
          startLine: currentLineNum,
          endLine: currentLineNum,
          type: "removed",
        });
        removed++;
      } else if (line.startsWith(" ")) {
        resultLines.push(line.substring(1));
      } else {
        // Just include other lines as-is (like @@ lines or headers)
        resultLines.push(line);
      }
    });

    return {
      code: resultLines.join("\n"),
      lineHighlights,
      stats: { added, removed },
    };
  }

  // Fallback: Not a recognized diff
  return {
    code: diffText,
    lineHighlights: [],
    stats: { added: 0, removed: 0 },
  };
};

/**
 * Checks if the text looks like a diff or SEARCH/REPLACE block
 */
export const isDiff = (text: string, language?: string): boolean => {
  if (language === "diff") return true;
  if (
    text.includes("<<<<<<< SEARCH") &&
    text.includes("=======") &&
    text.includes("REPLACE")
  )
    return true;

  // Basic git diff check: contains + or - markers at start of lines
  const lines = text.split("\n");
  const markers = lines.filter((l) => l.startsWith("+ ") || l.startsWith("- "));
  return markers.length > 0;
};
