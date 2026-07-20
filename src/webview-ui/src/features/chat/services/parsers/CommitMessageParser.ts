import { extractParamValue } from "../../utils/ToolParser";
import { CommitMessageParams } from "../../types/tool-types";

/**
 * Parse commit_message tag from AI response
 * Format: <commit_message><message>...</message></commit_message>
 */
export function parseCommitMessage(innerContent: string): CommitMessageParams {
  const params: CommitMessageParams = {};

  // Extract commit message content
  const messageParam = extractParamValue(innerContent, "message");
  if (messageParam) {
    params.message = messageParam;
  }
  
  // Or get the full content if no specific param
  if (!params.message && innerContent.trim()) {
    params.message = innerContent.trim();
  }

  return params;
}
