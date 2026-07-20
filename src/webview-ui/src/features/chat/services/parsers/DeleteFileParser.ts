import { extractParamValue } from "../../utils/ToolParser";

export interface DeleteFileParams {
  file_path: string;
}

export const parseDeleteFile = (innerContent: string): DeleteFileParams => {
  // Parse according to tools-reference.ts schema: file_path only
  const filePath = extractParamValue(innerContent, "file_path");

  return {
    file_path: filePath || "",
  };
};
