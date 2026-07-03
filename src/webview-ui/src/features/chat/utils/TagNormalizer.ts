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

// Import tool variants from constants
import { TOOL_VARIANTS } from "../constants/constants";

/**
 * Maps every known AI-generated variant of a tool tag name to its canonical
 * form. Each tag manages its own variants in its respective folder.
 */
const TAG_VARIANTS = TOOL_VARIANTS;

/**
 * Normalize all known tag name variants to their canonical forms, and also
 * handle the simple singular-form aliases.
 */
export const normalizeTagVariants = (content: string): string => {
  let result = content;

  // Normalize singular/variant tool tag names to canonical forms
  result = result
    .replace(/<(\/?)search_file>/gi, "<$1search_files>")
    .replace(/<(\/?)list_file>/gi, "<$1list_files>")
    .replace(/<(\/?)read_files>/gi, "<$1read_file>");

  // Explicit variant normalization via TAG_VARIANTS map
  for (const [canonical, variants] of Object.entries(TAG_VARIANTS)) {
    const escaped = variants.map((v) =>
      v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    const pattern = new RegExp(
      `<(\\/?)(${escaped.join("|")})(\\s[^>]*)?\\s*>`,
      "g",
    );
    result = result.replace(
      pattern,
      (_m, slash: string, _tag: string, attrs: string | undefined) =>
        `<${slash}${canonical}${attrs ?? ""}>`,
    );
  }

  return result;
};
