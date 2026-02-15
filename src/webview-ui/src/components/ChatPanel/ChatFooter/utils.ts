import { ALLOWED_FILE_EXTENSIONS } from "./constants";
import { WorkspaceItem } from "./types";

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
  message: string
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
