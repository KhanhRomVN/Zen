import { extractParam } from "../../utils/ToolParser";

export interface RevertFileParams {
  file_path: string;
}

export const parseRevertFile = (innerContent: string): RevertFileParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const filePath = extractParam(
    innerContent,
    "path",
    "file_path",
    "filePath",
    "filepath",
  );

  return {
    file_path: filePath || "",
  };
};
