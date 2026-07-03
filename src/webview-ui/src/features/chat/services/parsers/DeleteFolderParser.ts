import { extractParamValue } from "../../utils/ToolParser";

export interface DeleteFolderParams {
  folder_path: string;
}

export const parseDeleteFolder = (innerContent: string): DeleteFolderParams => {
  const folderPath = extractParamValue(innerContent, "folder_path");

  return {
    folder_path: folderPath || "",
  };
};
