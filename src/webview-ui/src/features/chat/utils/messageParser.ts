import { QuestionAnswer } from "../types/message";

/**
 * Parse <question-answer> tag from user message content
 * Format: <question-answer>\n1. {questionId}: {answer}\n2. {questionId}: {answer}\n</question-answer>
 * Returns Record<questionId, QuestionAnswer>
 */
export const parseQuestionAnswerTag = (
  content: string,
): Record<string, QuestionAnswer> | null => {
  const regex = /<question-answer>([\s\S]*?)<\/question-answer>/i;
  const match = regex.exec(content);
  if (!match) return null;

  const innerContent = match[1].trim();
  const answers: Record<string, QuestionAnswer> = {};

  // Parse each line: "1. {questionId}: {answer}"
  const lines = innerContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "No answer") continue;

    // Match pattern: "N. questionId: answer"
    const lineMatch = /^\d+\.\s+([^:]+):\s+(.+)$/i.exec(trimmed);
    if (!lineMatch) continue;

    const questionId = lineMatch[1].trim();
    const answerValue = lineMatch[2].trim();

    // Parse answer value (could be array for multi-choice)
    let parsedValue: string | string[] | boolean = answerValue;

    // Check if it's a boolean (for confirm type)
    if (answerValue.toLowerCase() === "true") {
      parsedValue = true;
    } else if (answerValue.toLowerCase() === "false") {
      parsedValue = false;
    } else if (answerValue.includes(",")) {
      // Array for multi-choice
      parsedValue = answerValue.split(",").map((v) => v.trim());
    }

    answers[questionId] = {
      questionId,
      value: parsedValue,
    };
  }

  return Object.keys(answers).length > 0 ? answers : null;
};

/**
 * Returns only top-level entries from a formatted tree string.
 */
export const getShallowTree = (tree: string): string => {
  const lines = tree.split("\n");
  const result: string[] = [];
  let currentFolder: string | null = null;
  let fileCount = 0;

  const flush = () => {
    if (currentFolder !== null) {
      result.push(`${currentFolder} (${fileCount} files)`);
      currentFolder = null;
      fileCount = 0;
    }
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    const isTopLevel = !/^ /.test(line);
    if (isTopLevel) {
      flush();
      if (line.trimEnd().endsWith("/")) {
        currentFolder = line.trimEnd();
      } else {
        result.push(line);
      }
    } else if (currentFolder !== null) {
      if (!line.trimEnd().endsWith("/")) fileCount++;
    }
  }
  flush();
  return result.join("\n");
};
