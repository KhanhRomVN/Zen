import { extractParam } from "../../utils/ToolParser";

export interface MoveFileParams {
  file_path: string;
  target_folder_path: string;
}

export const parseMoveFile = (innerContent: string): MoveFileParams => {
  // Try canonical names first (after normalization), then fallback to variants
  const filePath = extractParam(innerContent, "source", "file_path", "filePath", "sourcePath", "source_path", "from", "oldPath", "old_path");
  const targetFolderPath = extractParam(
    innerContent,
    "destination",
    "target_folder_path",
    "targetFolderPath",
    "destPath",
    "dest_path",
    "to",
    "newPath",
    "new_path"
  );

  return {
    file_path: filePath || "",
    target_folder_path: targetFolderPath || "",
  };
};
