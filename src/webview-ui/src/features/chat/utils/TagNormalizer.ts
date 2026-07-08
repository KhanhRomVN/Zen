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

// Import tool registry to get variants
import { TOOL_REGISTRY } from "../constants/tool-registry";

/**
 * Get all tool variants from registry (auto-generated)
 */
const getToolVariants = (): Record<string, string[]> => {
  return Object.fromEntries(
    Object.values(TOOL_REGISTRY).map(def => [def.type, def.variants])
  );
};

/**
 * Get attribute aliases for a specific tool type
 */
const getAttributeAliases = (toolType: string): Record<string, string[]> => {
  return TOOL_REGISTRY[toolType]?.attributeAliases ?? {};
};

/**
 * Normalize attribute names within a tool tag's content
 * Example: <filePath>test.ts</filePath> → <path>test.ts</path>
 */
const normalizeAttributesInToolContent = (toolType: string, content: string): string => {
  const aliases = getAttributeAliases(toolType);
  if (Object.keys(aliases).length === 0) return content;

  let result = content;
  
  for (const [canonical, variants] of Object.entries(aliases)) {
    if (variants.length === 0) continue;
    
    // Escape special regex characters in variants
    const escaped = variants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    
    // Match opening and closing tags: <variant> and </variant>
    const pattern = new RegExp(
      `<(\\/?)(${escaped.join("|")})(\\s[^>]*)?\\s*>`,
      "gi"
    );
    
    result = result.replace(
      pattern,
      (_match, slash: string, _attrName: string, attrs: string | undefined) =>
        `<${slash}${canonical}${attrs ?? ""}>`
    );
  }
  
  return result;
};

/**
 * Normalize all known tag name variants to their canonical forms, and also
 * handle the simple singular-form aliases.
 * 
 * CRITICAL: Also normalizes attribute names within tool tags to ensure
 * parsers can find the expected attribute names (e.g., <filePath> → <path>)
 */
export const normalizeTagVariants = (content: string): string => {
  let result = content;

  // Normalize singular/variant tool tag names to canonical forms
  result = result
    .replace(/<(\/?)search_file>/gi, "<$1search_files>")
    .replace(/<(\/?)list_file>/gi, "<$1list_files>")
    .replace(/<(\/?)read_files>/gi, "<$1read_file>")
    .replace(/<(\/?)conversation_compress>/gi, "<$1context_compression>");

  // Explicit variant normalization via registry variants
  const TAG_VARIANTS = getToolVariants();
  for (const [canonical, variants] of Object.entries(TAG_VARIANTS)) {
    if (variants.length === 0) continue; // Skip tools with no variants
    
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

  // CRITICAL: Normalize attributes within each tool tag
  // Process each tool type that has attribute aliases
  for (const [toolType, def] of Object.entries(TOOL_REGISTRY)) {
    if (!def.attributeAliases || Object.keys(def.attributeAliases).length === 0) {
      continue;
    }
    
    // Find all instances of this tool tag and normalize their content
    const toolPattern = new RegExp(
      `<${toolType}>([\\s\\S]*?)<\\/${toolType}>`,
      "gi"
    );
    
    result = result.replace(toolPattern, (match, innerContent: string) => {
      const normalized = normalizeAttributesInToolContent(toolType, innerContent);
      return `<${toolType}>${normalized}</${toolType}>`;
    });
  }

  return result;
};
