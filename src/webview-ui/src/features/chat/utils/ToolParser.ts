import { decodeHtmlEntities } from "./TagNormalizer";

/**
 * Params that carry multi-line file content — must NOT be trimmed so that
 * leading/trailing newlines (which are meaningful code lines) are preserved
 * when an SSE stream is split across multiple chunks.
 */
export const CONTENT_PARAMS = new Set(["content", "diff"]);

/**
 * Extract a param value trying multiple tag name aliases in order.
 * Useful when AI may use camelCase variants (e.g. filePath vs file_path).
 */
export const extractParam = (
  content: string,
  ...aliases: string[]
): string | null => {
  for (const alias of aliases) {
    const value = extractParamValue(content, alias);
    if (value !== null && value !== "") return value;
  }
  return null;
};

export const extractParamValue = (
  content: string,
  paramName: string,
): string | null => {
  // Whether this param holds raw file content (no aggressive trimming allowed)
  const isContentParam = CONTENT_PARAMS.has(paramName);

  // Try standard XML tag first
  const standardRegex = new RegExp(
    `<${paramName}>([\\s\\S]*?)<\\/${paramName}>`,
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

  const selfClosingRegex = isContentParam
    ? new RegExp(`<${paramName}\\s*>([\\s\\S]*)$`, "i")
    : new RegExp(
        `<${paramName}\\s*>([\\s\\S]*?)(?=<\\/?[\\w_]+\\s*>|$)`,
        "i",
      );
  const selfClosingMatch = content.match(selfClosingRegex);
  if (selfClosingMatch) {
    let value = selfClosingMatch[1];
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    let decoded = decodeHtmlEntities(value);
    if (!isContentParam) {
      decoded = decoded.trim();
      // Strip any residual malformed closing tag suffix like /paramName> or paramName>
      const malformedCloseRegex = new RegExp(`/?${paramName}>?$`, "i");
      decoded = decoded.replace(malformedCloseRegex, "").trim();
    } else {
      decoded = decoded.replace(/^\n|\n$/g, "");
    }
    return decoded;
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
