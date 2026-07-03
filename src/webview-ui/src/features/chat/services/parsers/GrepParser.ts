import { extractParamValue } from "../../utils/ToolParser";

export interface GrepParams {
  pattern: string;
  folder_path?: string;
  file_pattern?: string;
}

export const parseGrep = (innerContent: string): GrepParams => {
  const pattern = extractParamValue(innerContent, "pattern");
  const folderPath = extractParamValue(innerContent, "folder_path");
  const filePattern = extractParamValue(innerContent, "file_pattern");

  return {
    pattern: pattern || "",
    folder_path: folderPath || undefined,
    file_pattern: filePattern || undefined,
  };
};
