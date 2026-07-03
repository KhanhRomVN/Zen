import { extractParamValue } from "../../utils/ToolParser";

export interface WriteToFileParams {
  file_path: string;
  content: string;
}

export const parseWriteToFile = (innerContent: string): WriteToFileParams => {
  const filePath = extractParamValue(innerContent, "file_path");
  const content = extractParamValue(innerContent, "content");

  return {
    file_path: filePath || "",
    content: content || "",
  };
};
