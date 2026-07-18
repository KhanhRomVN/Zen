import { extractParam, extractParamValue } from "../../utils/ToolParser";

export interface RevertFileParams {
  file_path: string;
  version?: number;
}

export const parseRevertFile = (innerContent: string): RevertFileParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const filePath = extractParam(innerContent, "path", "file_path", "filePath", "filepath");
  
  // Extract version parameter (optional)
  const versionStr = extractParamValue(innerContent, "version");
  const version = versionStr ? parseInt(versionStr, 10) : undefined;

  return {
    file_path: filePath || "",
    version,
  };
};