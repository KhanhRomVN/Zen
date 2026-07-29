import { extractParamValue } from "../../utils/ToolParser";

export interface GrepParams {
  search_term: string;
  file_path?: string;
  folder_path?: string;
  file_pattern?: string;
  _validationError?: string; // Internal flag for invalid regex
}

/**
 * Validate regex pattern using Rust regex syntax
 * Returns error message if invalid, null if valid
 */
const validateRegexPattern = (pattern: string): string | null => {
  if (!pattern || pattern.trim() === "") {
    return "Empty search pattern";
  }

  try {
    // Test basic JavaScript regex compatibility
    // Note: Rust regex syntax differs slightly from JS, but this catches most errors
    new RegExp(pattern);

    // Additional checks for common Rust regex incompatibilities
    // Rust doesn't support lookbehind/lookahead
    if (
      pattern.includes("(?<") ||
      pattern.includes("(?!") ||
      pattern.includes("(?=")
    ) {
      return "Lookbehind/lookahead assertions are not supported. Use simpler pattern.";
    }

    return null; // Valid
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown regex error";
    return `Invalid regex pattern: ${message}`;
  }
};

export const parseGrep = (innerContent: string): GrepParams => {
  // Parse according to tools-reference.ts schema: search_term (required), file_path OR folder_path (one required)
  const searchTerm = extractParamValue(innerContent, "search_term");
  const filePath = extractParamValue(innerContent, "file_path");
  const folderPath = extractParamValue(innerContent, "folder_path");
  const filePattern = extractParamValue(innerContent, "file_pattern");

  const searchTermValue = searchTerm || "";

  // Validate required parameters
  if (!searchTermValue || searchTermValue.trim() === "") {
    const errorMsg = "Missing required parameter: search_term";
    console.error("[Zen][GrepParser] Validation error:", {
      error: errorMsg,
      innerContent: innerContent.substring(0, 200),
    });
    return {
      search_term: "",
      file_path: filePath || undefined,
      folder_path: folderPath || undefined,
      file_pattern: filePattern || undefined,
      _validationError: errorMsg,
    };
  }

  // Check if at least one path parameter is provided
  if ((!filePath || filePath.trim() === "") && (!folderPath || folderPath.trim() === "")) {
    const errorMsg =
      "Missing required parameter: either file_path or folder_path must be provided";
    console.error("[Zen][GrepParser] Validation error:", {
      error: errorMsg,
      innerContent: innerContent.substring(0, 200),
    });
    return {
      search_term: searchTermValue,
      file_path: undefined,
      folder_path: undefined,
      file_pattern: filePattern || undefined,
      _validationError: errorMsg,
    };
  }

  // Validate regex pattern
  const validationError = validateRegexPattern(searchTermValue);

  if (validationError) {
    console.error("[Zen][GrepParser] Invalid regex pattern:", {
      pattern: searchTermValue,
      error: validationError,
      innerContent: innerContent.substring(0, 200), // Log first 200 chars for debug
    });
  }

  return {
    search_term: searchTermValue,
    file_path: filePath || undefined,
    folder_path: folderPath || undefined,
    file_pattern: filePattern || undefined,
    _validationError: validationError || undefined,
  };
};
