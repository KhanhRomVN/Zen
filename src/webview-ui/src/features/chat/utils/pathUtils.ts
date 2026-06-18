import { Message } from "../types";

/**
 * Given a full path and all paths in the conversation, returns the shortest
 * disambiguating display label (filename, or parent/filename if duplicates exist).
 */
export const getDisplayPath = (
  fullPath: string,
  allPaths: string[],
): string => {
  const sep = /[/\\]/;
  const parts = fullPath.split(sep).filter(Boolean);
  if (parts.length === 0) return fullPath;

  for (let depth = 1; depth <= parts.length; depth++) {
    const candidate = parts.slice(-depth).join("/");
    const conflicts = allPaths.filter((p) => {
      const ps = p.split(sep).filter(Boolean);
      return ps.slice(-depth).join("/") === candidate && p !== fullPath;
    });
    if (conflicts.length === 0) return candidate;
  }
  return parts.join("/");
};

/**
 * Collects all file paths referenced by file-type tool actions across all messages.
 */
export const collectConvFilePaths = (allMessages: Message[]): string[] => {
  const paths: string[] = [];
  const filePathRegex = /<file_path>([\s\S]*?)<\/file_path>/g;
  for (const msg of allMessages) {
    if (msg.role !== "assistant") continue;
    let m: RegExpExecArray | null;
    while ((m = filePathRegex.exec(msg.content)) !== null) {
      if (m[1].trim()) paths.push(m[1].trim());
    }
    filePathRegex.lastIndex = 0;
  }
  return paths;
};
