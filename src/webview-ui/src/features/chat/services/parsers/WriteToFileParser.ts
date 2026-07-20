import { extractParamValue } from "../../utils/ToolParser";

// Enable debug logs via localStorage
const DEBUG_PARSER =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("zen_debug_parser") === "true";

export interface WriteToFileParams {
  file_path: string;
  content: string;
}

export const parseWriteToFile = (innerContent: string): WriteToFileParams => {
  // Parse according to tools-reference.ts schema: file_path only
  const filePath = extractParamValue(innerContent, "file_path");
  const content = extractParamValue(innerContent, "content");

  if (DEBUG_PARSER) {
    if (!filePath) {
      console.warn(
        "[Zen][WriteToFileParser] ⚠️ file_path is missing or empty!",
      );
    }
    if (!content) {
      console.warn("[Zen][WriteToFileParser] ⚠️ content is missing or empty!");
    }
  }

  return {
    file_path: filePath || "",
    content: content || "",
  };
};
