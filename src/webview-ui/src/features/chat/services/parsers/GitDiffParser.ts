import { extractParamValue } from "../../utils/ToolParser";
import { GitDiffParams } from "../../types/tool-types";

/**
 * Parse git_diff tag from AI response
 * Format: <git_diff><file_path>...</file_path></git_diff>
 * According to tools-reference.ts: file_path is optional
 */
export function parseGitDiff(innerContent: string): GitDiffParams {
  const params: GitDiffParams = {};

  // Extract file_path (optional according to schema)
  params.file_path = extractParamValue(innerContent, "file_path") ?? undefined;

  return params;
}
