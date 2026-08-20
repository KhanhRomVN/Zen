import Fuse from "fuse.js";

/**
 *? Usage:
 *    Tìm kiếm fuzzy trong nội dung file: dùng Fuse.js để tìm anchor line, sau đó xác minh toàn bộ block.
 *
 *? Function:
 *    findMatch(): Tìm vị trí khớp gần đúng nhất của searchBlock trong fileContent.
 */
export interface MatchResult {
  startIndex: number;
  endIndex: number; // Verification end index in file content
  originalText: string;
  score: number; // 0 = best/exact match, 1 = worst (Fuse distance)
  similarity: number; // 1.0 = best/exact match, 0.0 = worst
  startLine: number; // Line number where match starts (1-indexed)
}

export class FuzzyMatcher {
  /**
   * Find the best fuzzy match for the search block within the file content.
   * Uses Fuse.js to find potential anchors (first line), then verifies the full block.
   */
  public static findMatch(
    fileContent: string,
    searchBlock: string,
  ): MatchResult | null {
    // 1. Pre-process strings (normalize CRLF to LF)
    const normalizedFileContent = fileContent.replace(/\r\n/g, "\n");
    const normalizedSearchBlock = searchBlock.replace(/\r\n/g, "\n");

    const fileLines = normalizedFileContent.split("\n");
    const searchLines = normalizedSearchBlock.split("\n");

    // Normalize strings for comparison (remove whitespace to handle formatting diffs)
    const normalize = (str: string) => str.replace(/\s+/g, "");
    const normalizedSearch = normalize(normalizedSearchBlock);

    // Filter out empty lines from search block for anchoring
    const meaningfulSearchLines = searchLines.filter(
      (l) => l.trim().length > 0,
    );
    if (meaningfulSearchLines.length === 0) return null;

    const anchorLine = meaningfulSearchLines[0];

    // 2. Setup Fuse for finding key lines
    const lineList = fileLines.map((line, index) => ({ text: line, index }));
    const fuse = new Fuse(lineList, {
      keys: ["text"],
      includeScore: true,
      threshold: 0.6,
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
      const potentialStartLineIdx = fileAnchorIdx - (anchorOffsetInSearch >= 0 ? anchorOffsetInSearch : 0);
      if (potentialStartLineIdx < 0) continue;

      const maxWindowLines = Math.max(searchLines.length * 3, 20);

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
          normalizedCandidate,
        );

        if (similarity >= bestScore && similarity >= 0.6) {
          bestScore = similarity;
          bestMatch = {
            startIndex: this.getCharacterIndex(
              normalizedFileContent,
              potentialStartLineIdx,
            ),
            originalText: candidateBlock,
            endIndex: -1,
            score: 1 - similarity,
            similarity: similarity,
            startLine: potentialStartLineIdx + 1,
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
    const lines = content.split("\n");
    let index = 0;
    for (let i = 0; i < lineIndex; i++) {
      index += lines[i].length + 1;
    }
    return index;
  }
}
