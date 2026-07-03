import { extractParamValue } from "../../utils/ToolParser";

export interface MoveFileParams {
  file_path: string;
  target_folder_path: string;
}

export const parseMoveFile = (innerContent: string): MoveFileParams => {
  const filePath = extractParamValue(innerContent, "file_path");
  const targetFolderPath = extractParamValue(
    innerContent,
    "target_folder_path",
  );

  return {
    file_path: filePath || "",
    target_folder_path: targetFolderPath || "",
  };
};
