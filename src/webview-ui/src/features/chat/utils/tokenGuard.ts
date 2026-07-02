// src/webview-ui/src/features/chat/utils/tokenGuard.ts
import { calculateTokens } from "../services/ConversationService";
import {
  buildTokenLimitWarningPrompt,
  TokenLimitFileInfo,
} from "../prompts/token-limit-warning";

/** Tools that commonly produce large outputs and should be tracked for token overflow. */
const OVERFLOW_PRONE_TOOLS = new Set(["read_file", "list_files"]);

/**
 * Default max input token threshold (chars ÷ 4 ≈ tokens).
 * Conservative limit — most models allow 128k tokens but we warn
 * earlier (at ~80k) to leave room for the system prompt and conversation history.
 */
const MAX_INPUT_TOKEN_WARNING_THRESHOLD = 80_000;

/**
 * Given a list of executed actions and their results, build the TokenLimitFileInfo
 * breakdown used in the warning prompt.
 */
function buildOffendingFileList(
  actions: any[],
  results: string[],
): TokenLimitFileInfo[] {
  return actions
    .filter((a) => OVERFLOW_PRONE_TOOLS.has(a.type))
    .map((action, i) => {
      const result = results[i] || "";
      const estimatedTokens = Math.round(calculateTokens(result));
      const path =
        action.params?.path ||
        action.params?.file_path ||
        action.params?.folder_path ||
        "unknown";

      // Count lines in the result content
      const lineCount = result.split("\n").length;

      const startLine = action.params?.start_line
        ? parseInt(action.params.start_line)
        : undefined;
      const endLine = action.params?.end_line
        ? parseInt(action.params.end_line)
        : undefined;

      const toolType = action.type as TokenLimitFileInfo["toolType"];

      return {
        path,
        estimatedTokens,
        lineCount,
        startLine,
        endLine,
        toolType,
      };
    });
}

/**
 * Checks if the accumulated tool result content exceeds the token warning threshold.
 * If it does, prepends a token limit warning to the content so the AI knows to
 * adjust its approach on the next turn.
 *
 * Returns the (possibly modified) content string to pass to sendMessage.
 */
export const applyTokenLimitGuard = (
  content: string,
  actions: any[],
  results: string[],
): string => {
  const totalEstimatedTokens = calculateTokens(content);

  if (totalEstimatedTokens <= MAX_INPUT_TOKEN_WARNING_THRESHOLD) {
    return content;
  }

  const offendingFiles = buildOffendingFileList(actions, results);
  if (offendingFiles.length === 0) {
    // Overflow not from read/search/list — no actionable warning to give
    return content;
  }

  console.warn(
    `[Zen][TokenGuard] ⚠️ Token limit exceeded — prepending warning | files=${offendingFiles.length} | totalTokens=${totalEstimatedTokens}`,
  );

  const warning = buildTokenLimitWarningPrompt({
    totalEstimatedTokens,
    maxInputTokens: MAX_INPUT_TOKEN_WARNING_THRESHOLD,
    offendingFiles,
  });

  // Prepend warning — AI sees it first, then the raw tool results for context
  return `${warning}\n\n---\n\n${content}`;
};
