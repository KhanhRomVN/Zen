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

  // Use manual tag matching to avoid regex confusion with JSX/HTML in content
  // This approach finds the opening tag and then searches for the matching closing tag
  const openingTag = new RegExp(`<${paramName}(?:\\s+[^>]*)?>`, "i");
  const openingMatch = content.match(openingTag);

  if (openingMatch) {
    const startIndex = openingMatch.index! + openingMatch[0].length;
    const closingTag = `</${paramName}>`;
    const closingIndex = content.indexOf(closingTag, startIndex);

    if (closingIndex !== -1) {
      let value = content.substring(startIndex, closingIndex);
      // Remove ```text wrappers if present
      value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
      const decoded = decodeHtmlEntities(value);
      // For file content params: only strip a single leading/trailing newline added
      // by the XML tag boundaries — do NOT trim() which would eat real blank lines.
      // For other params (file_path, command, etc.): full trim is safe and expected.
      const result = isContentParam
        ? decoded.replace(/^\n|\n$/g, "")
        : decoded.trim();
      return result;
    }
  }

  // Fallback: Try regex-based extraction (legacy support)
  const standardRegex = new RegExp(
    `<${paramName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${paramName}>`,
    "i",
  );
  const standardMatch = content.match(standardRegex);
  if (standardMatch) {
    let value = standardMatch[1];
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    const decoded = decodeHtmlEntities(value);
    const result = isContentParam
      ? decoded.replace(/^\n|\n$/g, "")
      : decoded.trim();
    return result;
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
