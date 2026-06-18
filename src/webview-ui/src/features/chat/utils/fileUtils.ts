import { ALLOWED_FILE_EXTENSIONS } from "../constants/constants";

/** Returns true if the file extension is in the allowed list. */
export const isFileAllowed = (filename: string): boolean => {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.includes(ext);
};

/** Reads a File object as plain text. */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

/**
 * Extracts the replacement code block from a SEARCH/REPLACE diff string.
 * Falls back to returning the raw diff if the pattern is not found.
 */
export const parseNewCodeFromDiff = (diff: string): string => {
  if (!diff) return "";
  const replaceMatch = diff.match(
    /=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
  );
  if (replaceMatch) return replaceMatch[1].trim();
  return diff;
};

/** Opens a diff view in VS Code for the given action. */
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

/** Copies text to the clipboard. */
export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

/**
 * Extracts the search query from a mention string like `@file:query` or `@folder:query`.
 */
export const getSearchQuery = (message: string): string => {
  const fileMatch = message.match(/@file:\s*([^\s]*)$/);
  const folderMatch = message.match(/@folder:\s*([^\s]*)$/);
  if (fileMatch) return fileMatch[1] || "";
  if (folderMatch) return folderMatch[1] || "";
  return "";
};
