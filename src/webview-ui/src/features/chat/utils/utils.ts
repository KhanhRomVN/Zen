import { ACTION_NAMES, TOOL_LABELS, TOOL_COLORS } from "../constants/constants";
import { Message } from "../types";

export const getActionName = (type: string): string => {
  return ACTION_NAMES[type] || type;
};

export const getFilename = (action: any): string => {
  if (action.type === "run_command") {
    const id = action.params.terminal_id || "";
    const cmd = action.params.command || action.params.text || "";
    if (id && cmd)
      return `${id}: ${cmd.substring(0, 30)}${cmd.length > 30 ? "..." : ""}`;
    if (id) return id;
    return cmd.length > 50 ? cmd.substring(0, 50) + "..." : cmd;
  }
  const path =
    action.params.file_path ||
    action.params.folder_path ||
    action.params.path ||
    "";
  return path.split("/").pop() || path || "";
};

/**
 * Given a full path and all paths in the conversation, return the shortest
 * disambiguating display label (filename, or parent/filename if duplicates exist).
 */
export const getDisplayPath = (
  fullPath: string,
  allPaths: string[],
): string => {
  const sep = /[/\\]/;
  const parts = fullPath.split(sep).filter(Boolean);
  if (parts.length === 0) return fullPath;

  // Try increasing suffix lengths until unique among allPaths
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
 * Collect all file paths referenced by file-type tool actions across all messages.
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

export const getToolLabel = (type: string): string => {
  return TOOL_LABELS[type] || TOOL_LABELS.default;
};

export const getToolColor = (type: string): string => {
  return TOOL_COLORS[type] || TOOL_COLORS.default;
};

export const parseNewCodeFromDiff = (diff: string): string => {
  if (!diff) return "";
  const replaceMatch = diff.match(
    /=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
  );
  if (replaceMatch) return replaceMatch[1].trim();
  return diff;
};

export const handleDiffClick = (e: React.MouseEvent, action: any) => {
  e.stopPropagation();
  const vscodeApi = (window as any).vscodeApi;
  if (vscodeApi) {
    let newCode = "";
    if (action.type === "replace_in_file" && action.params.diff) {
      newCode = parseNewCodeFromDiff(action.params.diff);
    } else if (action.type === "write_to_file" && action.params.content) {
      newCode = action.params.content;
    }
    vscodeApi.postMessage({
      command: "openDiffView",
      filePath: action.params.path,
      newCode,
    });
  }
};

export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};
