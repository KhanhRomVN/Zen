import { ACTION_NAMES, TOOL_LABELS, TOOL_COLORS } from "../constants/constants";
import { Message, WorkspaceItem } from "../types";
import { ALLOWED_FILE_EXTENSIONS } from "../constants/constants";

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

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// Helper function to get search query from message
export const getSearchQuery = (message: string): string => {
  const fileMatch = message.match(/@file:\s*([^\s]*)$/);
  const folderMatch = message.match(/@folder:\s*([^\s]*)$/);

  if (fileMatch) {
    return fileMatch[1] || "";
  } else if (folderMatch) {
    return folderMatch[1] || "";
  }
  return "";
};

// Helper function to filter items based on search query
export const getFilteredItems = (
  items: WorkspaceItem[],
  message: string,
): WorkspaceItem[] => {
  const query = getSearchQuery(message).toLowerCase();
  if (!query) {
    return items;
  }
  return items.filter((item) => item.path.toLowerCase().includes(query));
};

export const isFileAllowed = (filename: string): boolean => {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.includes(ext);
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
