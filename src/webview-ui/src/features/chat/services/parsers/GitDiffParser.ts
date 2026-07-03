import { extractParam, extractParamValue } from "../../utils/ToolParser";
import { GitDiffParams } from "../../types/tool-types";

/**
 * Parse git_diff tag from AI response
 * Format: <git_diff><file_path>...</file_path><diff>...</diff></git_diff>
 */
export function parseGitDiff(innerContent: string): GitDiffParams {
  const params: GitDiffParams = {};

  // Extract file_path
  params.file_path = extractParam(
    innerContent,
    "file_path",
    "filePath",
    "filepath",
    "path",
  ) ?? undefined;
  
  // Also capture raw diff content if present
  const diffContent = extractParamValue(innerContent, "diff");
  if (diffContent) {
    params.diff = diffContent;
  }

  return params;
}
