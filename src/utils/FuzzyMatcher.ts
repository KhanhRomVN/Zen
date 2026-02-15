import Fuse from "fuse.js";

interface MatchResult {
  startIndex: number;
  endIndex: number; // Verification end index in file content
  originalText: string;
  score: number;
}

export class FuzzyMatcher {
  /**
   * Find the best fuzzy match for the search block within the file content.
   * Uses Fuse.js to find potential anchors (first line), then verifies the full block.
   */
  public static findMatch(
    fileContent: string,
    searchBlock: string
  ): MatchResult | null {
    // 1. Pre-process strings
    const fileLines = fileContent.split(/\r?\n/);
    const searchLines = searchBlock.split(/\r?\n/);

    // Normalize strings for comparison (remove whitespace to handle formatting diffs)
    const normalize = (str: string) => str.replace(/\s+/g, "");
    const normalizedSearch = normalize(searchBlock);

    // Filter out empty lines from search block for anchoring
    const meaningfulSearchLines = searchLines.filter(
      (l) => l.trim().length > 0
    );
    if (meaningfulSearchLines.length === 0) return null;

    const anchorLine = meaningfulSearchLines[0];

    // 2. Setup Fuse for finding key lines
    const lineList = fileLines.map((line, index) => ({ text: line, index }));
    const fuse = new Fuse(lineList, {
      keys: ["text"],
      includeScore: true,
      threshold: 0.6, // Increased threshold to catch partial matches (e.g. if 1-line search matches 1 line of file)
      ignoreLocation: true,
    });

    // 3. Search for the anchor line
    const anchorResults = fuse.search(anchorLine);

    // 4. Verify candidates with Dynamic Window Sizing
    let bestMatch: MatchResult | null = null;
    let bestScore = 0; // Similarity score (0 to 1, higher is better)

    const candidates = anchorResults.slice(0, 20); // Check top 20 matches

    for (const result of candidates) {
      const fileAnchorIdx = result.item.index;
      const anchorOffsetInSearch = searchLines.indexOf(anchorLine);

      // Determine probable start line in file
      const potentialStartLineIdx = fileAnchorIdx - anchorOffsetInSearch;
      if (potentialStartLineIdx < 0) continue;

      // Try expanding window size
      // We want to find a block in the file starting at potentialStartLineIdx
      // that matches normalizedSearch.
      // Maximum expansion: Let's assume the file version isn't > 5 times larger in lines
      const maxWindowLines = Math.max(searchLines.length * 5, 20);

      for (let length = 1; length <= maxWindowLines; length++) {
        const endIdx = potentialStartLineIdx + length;
        if (endIdx > fileLines.length) break;

        // Construct candidate block
        const candidateLines = fileLines.slice(potentialStartLineIdx, endIdx);
        const candidateBlock = candidateLines.join("\n");
        const normalizedCandidate = normalize(candidateBlock);

        // Calculate similarity
        const similarity = this.calculateSimilarity(
          normalizedSearch,
          normalizedCandidate
        );

        if (similarity >= bestScore && similarity > 0.7) {
          // 0.7 threshold
          bestScore = similarity;
          bestMatch = {
            startIndex: this.getCharacterIndex(
              fileContent,
              potentialStartLineIdx
            ),
            // We need the ACTUAL text to replace, so we need to know how much we matched.
            // But replace_in_file receives 'searchText' (the bad one) and 'replaceText'.
            // The 'targetSearchText' in replaceInFile will be set to 'originalText' from here.
            originalText: candidateBlock,
            endIndex: -1,
            // Log logic uses score. Let's return the similarity as score for now but inverted context matters?
            // The user saw 0.85 (which is high similarity).
            // Actually Fuse returns 0 for exact.
            // Let's stick to 0=exact for Consistency?
            // But I calculated similarity (1=exact).
            // I will return (1 - similarity) as "Fuse-like Score" (0=best).
            score: 1 - similarity,
          };
        }
        if (normalizedCandidate.length > normalizedSearch.length * 1.5) break;
      }
    }

    return bestMatch;
  }

  private static calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1;

    const getBigrams = (str: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };

    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);
    const intersection = new Set([...b1].filter((x) => b2.has(x))).size;

    return (2 * intersection) / (b1.size + b2.size);
  }

  private static getCharacterIndex(content: string, lineIndex: number): number {
    const lines = content.split(/\r?\n/);
    let index = 0;
    for (let i = 0; i < lineIndex; i++) {
      index += lines[i].length + 1;
    }
    return index;
  }
}
