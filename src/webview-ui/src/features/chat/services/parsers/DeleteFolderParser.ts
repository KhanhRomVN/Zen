import { extractParam } from "../../utils/ToolParser";

export interface DeleteFolderParams {
  folder_path: string;
}

export const parseDeleteFolder = (innerContent: string): DeleteFolderParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const folderPath = extractParam(innerContent, "path", "folder_path", "folderPath", "directoryPath", "directory_path");

  return {
    folder_path: folderPath || "",
  };
};
