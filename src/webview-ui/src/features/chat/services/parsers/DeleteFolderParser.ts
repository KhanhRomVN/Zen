import { extractParamValue } from "../../utils/ToolParser";

export interface DeleteFolderParams {
  folder_path: string;
}

export const parseDeleteFolder = (innerContent: string): DeleteFolderParams => {
  // Parse according to tools-reference.ts schema: folder_path only
  const folderPath = extractParamValue(innerContent, "folder_path");

  return {
    folder_path: folderPath || "",
  };
};
