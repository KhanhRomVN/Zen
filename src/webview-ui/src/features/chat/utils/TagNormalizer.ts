/**
 * Decode common HTML entities back to their original characters.
 * (Internal helper — not exported)
 */
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

// Re-export so ToolParser can import from one place without duplicating.
export { decodeHtmlEntities };

/**
 * Normalize singular-form tag aliases to canonical forms.
 * Only handles a few hardcoded special cases.
 */
export const normalizeTagVariants = (content: string): string => {
  let result = content;

  // Normalize singular/plural form aliases (hardcoded special cases)
  result = result
    .replace(/<(\/?)search_file>/gi, "<$1search_files>")
    .replace(/<(\/?)list_file>/gi, "<$1list_files>")
    .replace(/<(\/?)read_files>/gi, "<$1read_file>");

  return result;
};
