/**
 * Decode common HTML entities back to their original characters.
 * (Internal helper — not exported)
 */
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
};

// Re-export so ToolParser can import from one place without duplicating.
export { decodeHtmlEntities };