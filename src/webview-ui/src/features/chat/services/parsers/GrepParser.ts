import { extractParam, extractParamValue } from "../../utils/ToolParser";

export interface GrepParams {
  pattern: string;
  search_term?: string;  // Add search_term for backend compatibility
  folder_path?: string;
  file_pattern?: string;
  _validationError?: string;  // Internal flag for invalid regex
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
    if (pattern.includes("(?<") || pattern.includes("(?!") || pattern.includes("(?=")) {
      return "Lookbehind/lookahead assertions are not supported. Use simpler pattern.";
    }
    
    return null; // Valid
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown regex error";
    return `Invalid regex pattern: ${message}`;
  }
};

export const parseGrep = (innerContent: string): GrepParams => {
  // Try multiple aliases: pattern, search_term, search, query
  const pattern = extractParam(innerContent, "pattern", "search_term", "search", "query");
  const folderPath = extractParamValue(innerContent, "folder_path");
  const filePattern = extractParamValue(innerContent, "file_pattern");

  const patternValue = pattern || "";
  
  // Validate regex pattern
  const validationError = validateRegexPattern(patternValue);
  
  if (validationError) {
    console.error("[Zen][GrepParser] Invalid regex pattern:", {
      pattern: patternValue,
      error: validationError,
      innerContent: innerContent.substring(0, 200), // Log first 200 chars for debug
    });
  }

  return {
    pattern: patternValue,
    search_term: patternValue,  // Set search_term to same value as pattern
    folder_path: folderPath || undefined,
    file_pattern: filePattern || undefined,
    _validationError: validationError || undefined,
  };
};
