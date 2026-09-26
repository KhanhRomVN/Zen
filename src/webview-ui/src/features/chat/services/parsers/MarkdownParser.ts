/**
 * Preprocess custom <code language="xxx">...</code> response tags
 * into standard markdown fenced code blocks before passing to `marked`.
 */
const preprocessCodeTags = (content: string): string => {
  // Match <code language="lang">...</code> (supports multiline content)
  return content.replace(
    /<code\s+language=["']?(\w+)["']?>\s*([\s\S]*?)<\/code>/gi,
    (_match, lang, code) => `\n\`\`\`${lang}\n${code}\n\`\`\`\n`,
  );
};

export const parseMarkdown = (innerContent: string): string => {
  const trimmed = innerContent.trim();
  return preprocessCodeTags(trimmed);
};
