import { extractParam } from "../../utils/ToolParser";

export interface DeleteFileParams {
  file_path: string;
}

export const parseDeleteFile = (innerContent: string): DeleteFileParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const filePath = extractParam(innerContent, "path", "file_path", "filePath", "filepath");

  return {
    file_path: filePath || "",
  };
};
