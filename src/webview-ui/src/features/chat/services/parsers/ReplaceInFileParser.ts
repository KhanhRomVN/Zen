import { extractParam, extractParamValue } from "../../utils/ToolParser";

export interface ReplaceInFileParams {
  file_path: string;
  old_str: string;
  new_str: string;
  // Legacy diff field for backward compatibility
  diff?: string;
}

export const parseReplaceInFile = (
  innerContent: string,
): ReplaceInFileParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const filePath = extractParam(innerContent, "path", "file_path", "filePath", "filepath");
  
  // Try new schema first: <old_content> and <new_content>
  let oldStr = extractParamValue(innerContent, "old_content");
  let newStr = extractParamValue(innerContent, "new_content");
  
  // Fallback to legacy schema: <old_str> and <new_str>
  if (!oldStr) {
    oldStr = extractParamValue(innerContent, "old_str");
  }
  if (!newStr) {
    newStr = extractParamValue(innerContent, "new_str");
  }

  return {
    file_path: filePath || "",
    old_str: oldStr || "",
    new_str: newStr || "",
  };
};
