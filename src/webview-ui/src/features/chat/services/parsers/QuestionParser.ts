import type { Question, QuestionType } from "../../types/message";

/**
 * Parse question tag content into structured question data.
 * Supports both legacy (options array) and new (questions array with <q> elements) formats.
 */
export const parseQuestion = (
  innerContent: string,
): {
  options: string[];
  title?: string;
  optional?: boolean;
  questions?: Question[];
} => {
  const options: string[] = [];
  let title: string | undefined = undefined;
  const questions: Question[] = [];

  // Extract title if present (legacy)
  const titleMatch = /<question_title>([\s\S]*?)<\/question_title>/i.exec(
    innerContent,
  );
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Try to parse new schema with <q> elements
  let hasNewSchema = false;
  const content = innerContent || "";

  // Find all <q> tags
  let searchIndex = 0;
  while (searchIndex < content.length) {
    const qStart = content.indexOf("<q ", searchIndex);
    if (qStart === -1) break;

    let tagEnd = -1;
    let isSelfClosing = false;
    let i = qStart + 2;
    while (i < content.length) {
      if (content[i] === "<" && content[i + 1] === "/") break;
      if (content[i] === ">" && content[i - 1] === "/") {
        isSelfClosing = true;
        tagEnd = i;
        break;
      }
      if (content[i] === ">") {
        tagEnd = i;
        break;
      }
      i++;
    }

    if (tagEnd === -1) {
      searchIndex = qStart + 2;
      continue;
    }

    const openTag = content.substring(qStart, tagEnd + 1);
    const idMatch = openTag.match(/id="([^"]+)"/);
    const typeMatch = openTag.match(/type="([^"]+)"/);
    const doubleQuoteMatch = openTag.match(/label="([^"]*)"/);
    const singleQuoteMatch = openTag.match(/label='([^']*)'/);

    if (!idMatch || !typeMatch) {
      searchIndex = tagEnd + 1;
      continue;
    }

    hasNewSchema = true;
    const qId = idMatch[1].trim();
    const qType = typeMatch[1].trim() as QuestionType;

    // Extract and decode HTML entities in label
    let qLabel = doubleQuoteMatch
      ? doubleQuoteMatch[1].trim()
      : singleQuoteMatch
        ? singleQuoteMatch[1].trim()
        : `Question ${questions.length + 1}`;
    if (qLabel && qLabel !== `Question ${questions.length + 1}`) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = qLabel;
      qLabel = textarea.value;
    }

    let qInner = "";
    let closeTagEnd = tagEnd;

    if (!isSelfClosing) {
      const closeIndex = content.indexOf("</q>", tagEnd + 1);
      if (closeIndex !== -1) {
        qInner = content.substring(tagEnd + 1, closeIndex);
        closeTagEnd = closeIndex + 4;
      }
    } else {
      closeTagEnd = tagEnd + 1;
    }

    const qOptions: string[] = [];
    if (qInner.trim()) {
      const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
      let optMatch;
      while ((optMatch = optionRegex.exec(qInner)) !== null) {
        if (optMatch[1].trim()) {
          qOptions.push(optMatch[1].trim());
        }
      }
    }

    // For single/multi, ensure at least 2 options
    if (qType === "single" || qType === "multi") {
      if (qOptions.length < 2) {
        searchIndex = closeTagEnd;
        continue;
      }
    }

    questions.push({
      id: qId,
      type: qType,
      label: qLabel,
      options: qOptions.length > 0 ? qOptions : undefined,
    });

    searchIndex = closeTagEnd;
  }

  // If no new schema found, fall back to legacy parsing
  if (!hasNewSchema) {
    const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
    let optMatch;
    while ((optMatch = optionRegex.exec(innerContent)) !== null) {
      if (optMatch[1].trim()) {
        options.push(optMatch[1].trim());
      }
    }
  }

  const openTag = innerContent.match(/<question[^>]*>/)?.[0] || "";
  const optional = /optional=["']true["']/i.test(openTag);

  return {
    options: options.length > 0 ? options : [],
    title,
    optional,
    ...(questions.length > 0 ? { questions } : {}),
  };
};
