import { extractParamValue } from "../../utils/ToolParser";

export interface ReplaceInFileParams {
  file_path: string;
  old_str: string;
  new_str: string;
}

export const parseReplaceInFile = (
  innerContent: string,
): ReplaceInFileParams => {
  const filePath = extractParamValue(innerContent, "file_path");
  const oldStr = extractParamValue(innerContent, "old_str");
  const newStr = extractParamValue(innerContent, "new_str");

  return {
    file_path: filePath || "",
    old_str: oldStr || "",
    new_str: newStr || "",
  };
};
