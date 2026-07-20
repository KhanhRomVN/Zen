import { extractParam, extractParamValue } from "../../utils/ToolParser";

// Enable debug logs via localStorage
const DEBUG_PARSER =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("zen_debug_parser") === "true";

export interface WriteToFileParams {
  file_path: string;
  content: string;
}

export const parseWriteToFile = (innerContent: string): WriteToFileParams => {
  // Try canonical name first, then fallback to variants
  // Order matters: canonical → common aliases
  const filePath = extractParam(innerContent, "file_path", "path", "filePath", "filepath");
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
