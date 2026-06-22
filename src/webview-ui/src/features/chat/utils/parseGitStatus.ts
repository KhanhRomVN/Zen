/**
 * Shared git status parser used by both GitToolRenderer and ChatPanel (index.tsx).
 * Parses git status --porcelain output into a structured array.
 */

export interface GitStatusEntry {
  status: string;
  path: string;
  staged: boolean;
  added?: number;
  deleted?: number;
}

/**
 * Parse git status --porcelain output into GitStatusEntry array.
 *
 * Porcelain format (two-char status codes):
 *   "M  file.txt" - staged modified
 *   " M file.txt" - unstaged modified
 *   "D  file.txt" - staged deleted
 *   "A  file.txt" - staged added
 *   "?? file.txt" - untracked
 *   "R  old -> new" - renamed
 */
export const parseGitStatusOutput = (output: string): GitStatusEntry[] => {
  if (!output || output.trim() === "") return [];

  const lines = output.split("\n").filter((line) => line.trim() !== "");
  const items: GitStatusEntry[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (line.length < 2) continue;

    const firstChar = line[0];
    const secondChar = line[1];

    let status = "";
    let path = "";
    let staged = false;

    if (firstChar === "?" && secondChar === "?") {
      // Untracked file
      status = "?";
      staged = false;
    } else if (firstChar === " " && secondChar !== " ") {
      // Only unstaged changes
      status = secondChar;
      staged = false;
    } else if (firstChar !== " " && secondChar === " ") {
      // Only staged changes
      status = firstChar;
      staged = true;
    } else if (firstChar !== " " && secondChar !== " ") {
      // Both staged and unstaged changes
      status = firstChar;
      staged = true;
    } else {
      status = firstChar;
      staged = false;
    }

    // Extract path (after two-char status code + space(s))
    const statusPattern = /^[A-Z? ]{2}\s+/;
    const match = line.match(statusPattern);
    if (match) {
      path = line.substring(match[0].length).trim();
    } else {
      const parts = line.split(/\s+/);
      path = parts.length >= 2 ? parts.slice(1).join(" ") : line;
    }

    // Handle renamed/copied: "R  old.txt -> new.txt"
    if ((status === "R" || status === "C") && path.includes(" -> ")) {
      path = path.split(" -> ")[1] || path;
    }

    items.push({
      status: status.trim(),
      path: path.trim(),
      staged,
    });
  }

  return items;
};
