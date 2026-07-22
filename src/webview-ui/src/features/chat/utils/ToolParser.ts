import { decodeHtmlEntities } from "./HtmlEntitiesDecoder";

/**
 * Params that carry multi-line file content — must NOT be trimmed so that
 * leading/trailing newlines (which are meaningful code lines) are preserved
 * when an SSE stream is split across multiple chunks.
 */
export const CONTENT_PARAMS = new Set(["content", "diff"]);

export const extractParamValue = (
  content: string,
  paramName: string,
): string | null => {
  // Whether this param holds raw file content (no aggressive trimming allowed)
  const isContentParam = CONTENT_PARAMS.has(paramName);

  // Try standard XML tag (fully closed tag)
  // More flexible regex: allows optional whitespace and newlines
  const standardRegex = new RegExp(
    `<${paramName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${paramName}>`,
    "i",
  );
  const standardMatch = content.match(standardRegex);
  if (standardMatch) {
    let value = standardMatch[1];
    // Remove ```text wrappers if present
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    const decoded = decodeHtmlEntities(value);
    // For file content params: only strip a single leading/trailing newline added
    // by the XML tag boundaries — do NOT trim() which would eat real blank lines.
    // For other params (file_path, command, etc.): full trim is safe and expected.
    return isContentParam ? decoded.replace(/^\n|\n$/g, "") : decoded.trim();
  }

  // Fallback: Try to extract with more lenient pattern
  // This handles cases where tags might not be perfectly formatted
  const lenientRegex = new RegExp(
    `<${paramName}[^>]*>\\s*([\\s\\S]*?)\\s*<\\/${paramName}>`,
    "i",
  );
  const lenientMatch = content.match(lenientRegex);
  if (lenientMatch) {
    let value = lenientMatch[1];
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    const decoded = decodeHtmlEntities(value);
    return isContentParam ? decoded.replace(/^\n|\n$/g, "") : decoded.trim();
  }

  return null;
};

/**
 * Parse tool actions. Currently a no-op passthrough since all tools
 * have dedicated parsers in their tag folders.
 */
export const parseToolAction = (
  toolName: string,
  _innerContent: string,
  rawXml: string,
): any => {
  const params: Record<string, any> = {};

  return {
    type: toolName as any,
    params,
    rawXml,
  };
};
