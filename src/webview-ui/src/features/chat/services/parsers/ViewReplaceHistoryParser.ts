import { extractParam } from "../../utils/ToolParser";

export interface ViewReplaceHistoryParams {
  file_path: string;
}

export const parseViewReplaceHistory = (innerContent: string): ViewReplaceHistoryParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const filePath = extractParam(innerContent, "path", "file_path", "filePath", "filepath");

  return {
    file_path: filePath || "",
  };
};
