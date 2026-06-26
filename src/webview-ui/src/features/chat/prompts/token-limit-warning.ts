/**
 * Token limit warning prompt — auto-injected when a tool call batch is about to
 * exceed the model's max input token limit.
 *
 * Triggered by: useToolExecution before calling handleSendMessageRef (autoReq)
 * when the estimated token count of the accumulated tool results exceeds the
 * model's input token limit.
 *
 * Supported tool types that commonly cause token overflow:
 *   - read_file   → large files or too many files in one response
 *   - grep → accidentally hitting node_modules or large directories
 *   - list_files  → deep recursive listing of huge folder trees
 */

export interface TokenLimitFileInfo {
  /** Relative or absolute file/folder path that was read/searched/listed */
  path: string;
  /** Estimated token count for this tool result */
  estimatedTokens: number;
  /** Total lines in the file (for read_file) or number of matches (for grep) */
  lineCount?: number;
  /** start_line used in the read_file call, if any */
  startLine?: number;
  /** end_line used in the read_file call, if any */
  endLine?: number;
  /** Tool type that produced this result */
  toolType: "read_file" | "grep" | "list_files" | "other";
}

export interface TokenLimitWarningOptions {
  /** Total estimated tokens for the current autoReq payload */
  totalEstimatedTokens: number;
  /** Model's max input token limit */
  maxInputTokens: number;
  /** List of tool calls that contributed to the overflow */
  offendingFiles: TokenLimitFileInfo[];
}

/**
 * Builds an auto-request message instructing the AI to adjust its parameters
 * to avoid exceeding the model's max input token limit.
 *
 * This message is sent as a hidden autoReq (uiHidden=true) so the user does not
 * see it in the chat, but the AI receives it as a correction instruction before
 * the next planning turn.
 */
export const buildTokenLimitWarningPrompt = (
  opts: TokenLimitWarningOptions,
): string => {
  const { totalEstimatedTokens, maxInputTokens, offendingFiles } = opts;

  const overagePercent = Math.round(
    ((totalEstimatedTokens - maxInputTokens) / maxInputTokens) * 100,
  );

  // Group files by tool type for a cleaner breakdown
  const readFiles = offendingFiles.filter((f) => f.toolType === "read_file");
  const listFiles = offendingFiles.filter((f) => f.toolType === "list_files");
  const otherFiles = offendingFiles.filter((f) => f.toolType === "other");

  const formatFileEntry = (f: TokenLimitFileInfo): string => {
    const parts: string[] = [`  - \`${f.path}\``];
    if (f.lineCount !== undefined) parts.push(`(${f.lineCount} lines)`);
    if (f.startLine !== undefined || f.endLine !== undefined) {
      const range = [
        f.startLine !== undefined ? `start=${f.startLine}` : null,
        f.endLine !== undefined ? `end=${f.endLine}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      if (range) parts.push(`[${range}]`);
    }
    parts.push(`→ ~${f.estimatedTokens.toLocaleString()} tokens`);
    return parts.join(" ");
  };

  let prompt = `⚠️ **MAX INPUT TOKEN WARNING** — The tool results from your last response are too large to send back.`;
  prompt += `\n\nEstimated payload: **~${totalEstimatedTokens.toLocaleString()} tokens** (${overagePercent > 0 ? `+${overagePercent}% over` : "at"} the ${maxInputTokens.toLocaleString()} token limit).`;
  prompt += `\n\nThe following tool calls contributed to this overflow. You MUST adjust your approach before retrying:\n`;

  if (readFiles.length > 0) {
    prompt += `\n### read_file (${readFiles.length} file${readFiles.length > 1 ? "s" : ""}):\n`;
    prompt += readFiles.map(formatFileEntry).join("\n");
    prompt += `\n\n**Fix**: Use \`start_line\`/\`end_line\` to read only the relevant section of each file, or split into multiple turns and read one file at a time.`;
  }

  if (listFiles.length > 0) {
    prompt += `\n\n### list_files (${listFiles.length} listing${listFiles.length > 1 ? "s" : ""}):\n`;
    prompt += listFiles.map(formatFileEntry).join("\n");
    prompt += `\n\n**Fix**: Reduce the \`depth\` parameter, or list a more specific subfolder instead of a large parent directory.`;
  }

  if (otherFiles.length > 0) {
    prompt += `\n\n### Other tools:\n`;
    prompt += otherFiles.map(formatFileEntry).join("\n");
  }

  prompt += `\n\n---\n`;
  prompt += `Please revise your plan to avoid reading too much content at once. `;
  prompt += `Pick the **most relevant** files/sections first, process them, then fetch additional context only if needed.`;

  return prompt;
};
