import { extractParam, extractParamValue } from "../../utils/ToolParser";

export interface GrepParams {
  pattern: string;
  search_term?: string;  // Add search_term for backend compatibility
  folder_path?: string;
  file_pattern?: string;
}

export const parseGrep = (innerContent: string): GrepParams => {
  // Try multiple aliases: pattern, search_term, search, query
  const pattern = extractParam(innerContent, "pattern", "search_term", "search", "query");
  const folderPath = extractParamValue(innerContent, "folder_path");
  const filePattern = extractParamValue(innerContent, "file_pattern");

  return {
    pattern: pattern || "",
    search_term: pattern || "",  // Set search_term to same value as pattern
    folder_path: folderPath || undefined,
    file_pattern: filePattern || undefined,
  };
};
