import { extractParamValue } from "../../utils/ToolParser";
import { GitStatusParams } from "../../types/tool-types";

/**
 * Parse git_status tag from AI response
 * Format: <git_status><items>...</items><raw>...</raw></git_status>
 */
export function parseGitStatus(innerContent: string): GitStatusParams {
  const params: GitStatusParams = {};

  // Extract items as JSON string
  const itemsParam = extractParamValue(innerContent, "items");
  if (itemsParam) {
    params.items = itemsParam;
  }

  // Extract raw output
  const rawParam = extractParamValue(innerContent, "raw");
  if (rawParam) {
    params.raw = rawParam;
  }

  return params;
}
