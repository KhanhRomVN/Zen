import { extractParam, extractParamValue } from "../../utils/ToolParser";

export interface ReadFileParams {
  file_path: string;
  start_line?: number;
  end_line?: number;
}

export const parseReadFile = (innerContent: string): ReadFileParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const filePath = extractParam(innerContent, "path", "file_path", "filePath", "filepath");
  const startLine = extractParamValue(innerContent, "start_line");
  const endLine = extractParamValue(innerContent, "end_line");

  return {
    file_path: filePath || "",
    start_line: startLine ? parseInt(startLine, 10) : undefined,
    end_line: endLine ? parseInt(endLine, 10) : undefined,
  };
};
