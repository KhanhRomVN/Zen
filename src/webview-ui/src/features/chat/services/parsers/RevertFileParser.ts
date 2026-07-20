import { extractParamValue } from "../../utils/ToolParser";

export interface RevertFileParams {
  file_path: string;
  version?: number;
}

export const parseRevertFile = (innerContent: string): RevertFileParams => {
  // Parse according to tools-reference.ts schema: file_path only
  const filePath = extractParamValue(innerContent, "file_path");
  
  // Extract version parameter (optional)
  const versionStr = extractParamValue(innerContent, "version");
  const version = versionStr ? parseInt(versionStr, 10) : undefined;

  return {
    file_path: filePath || "",
    version,
  };
};