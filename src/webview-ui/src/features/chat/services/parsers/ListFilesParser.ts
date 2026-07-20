import { extractParamValue } from "../../utils/ToolParser";

export interface ListFilesParams {
  folder_path: string;
  type?: string;
  depth?: number | "max";
}

export const parseListFiles = (innerContent: string): ListFilesParams => {
  // Parse according to tools-reference.ts schema: folder_path only
  const folderPath = extractParamValue(innerContent, "folder_path");
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
