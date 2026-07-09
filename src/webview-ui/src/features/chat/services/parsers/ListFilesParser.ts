import { extractParam, extractParamValue } from "../../utils/ToolParser";

export interface ListFilesParams {
  folder_path: string;
  type?: string;
  depth?: number | "max";
}

export const parseListFiles = (innerContent: string): ListFilesParams => {
  // Try canonical name first (after normalization), then fallback to variants
  const folderPath = extractParam(innerContent, "path", "folder_path", "folderPath", "dirPath", "dir_path", "directoryPath", "directory_path");
  const type = extractParamValue(innerContent, "type");
  const depthStr = extractParamValue(innerContent, "depth");
  
  let depth: number | "max" | undefined;
  if (depthStr) {
    if (depthStr.toLowerCase() === "max") {
      depth = "max";
    } else {
      const parsed = parseInt(depthStr, 10);
      depth = !isNaN(parsed) ? parsed : undefined;
    }
  }

  return {
    folder_path: folderPath || "",
    type: type || undefined,
    depth,
  };
};
