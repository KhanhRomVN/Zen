import { extractParamValue } from "../../utils/ToolParser";

export interface ViewReplaceHistoryParams {
  file_path: string;
}

export const parseViewReplaceHistory = (innerContent: string): ViewReplaceHistoryParams => {
  // Parse according to tools-reference.ts schema: file_path only
  const filePath = extractParamValue(innerContent, "file_path");

  return {
    file_path: filePath || "",
  };
};
