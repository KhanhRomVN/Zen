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

  console.log(`[extractParamValue] Extracting param: ${paramName}`);
  console.log(`[extractParamValue] Content length: ${content.length}`);
  console.log(`[extractParamValue] isContentParam: ${isContentParam}`);

  // Use manual tag matching to avoid regex confusion with JSX/HTML in content
  // This approach finds the opening tag and then searches for the matching closing tag
  const openingTag = new RegExp(`<${paramName}(?:\\s+[^>]*)?>`, "i");
  const openingMatch = content.match(openingTag);
  
  if (openingMatch) {
    console.log(`[extractParamValue] Found opening tag at index: ${openingMatch.index}`);
    const startIndex = openingMatch.index! + openingMatch[0].length;
    const closingTag = `</${paramName}>`;
    const closingIndex = content.indexOf(closingTag, startIndex);
    
    console.log(`[extractParamValue] Looking for closing tag: ${closingTag}`);
    console.log(`[extractParamValue] Closing tag found at index: ${closingIndex}`);
    
    if (closingIndex === -1) {
      // Closing tag not found - show the content from startIndex to help debug
      const remainingContent = content.substring(startIndex);
      console.log(`[extractParamValue] ⚠️ DEBUG: Remaining content length: ${remainingContent.length}`);
      console.log(`[extractParamValue] ⚠️ DEBUG: Last 200 chars of content:`, content.substring(Math.max(0, content.length - 200)));
      console.log(`[extractParamValue] ⚠️ DEBUG: Content after opening tag (first 300 chars):`, remainingContent.substring(0, 300));
      console.log(`[extractParamValue] ⚠️ DEBUG: Content after opening tag (last 300 chars):`, remainingContent.substring(Math.max(0, remainingContent.length - 300)));
    }
    
    if (closingIndex !== -1) {
      let value = content.substring(startIndex, closingIndex);
      console.log(`[extractParamValue] Extracted value length: ${value.length}`);
      console.log(`[extractParamValue] First 100 chars: ${value.substring(0, 100)}`);
      console.log(`[extractParamValue] Last 100 chars: ${value.substring(Math.max(0, value.length - 100))}`);
      
      // Remove ```text wrappers if present
      value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
      const decoded = decodeHtmlEntities(value);
      // For file content params: only strip a single leading/trailing newline added
      // by the XML tag boundaries — do NOT trim() which would eat real blank lines.
      // For other params (file_path, command, etc.): full trim is safe and expected.
      const result = isContentParam ? decoded.replace(/^\n|\n$/g, "") : decoded.trim();
      console.log(`[extractParamValue] ✅ SUCCESS - Returning value length: ${result.length}`);
      return result;
    } else {
      console.warn(`[extractParamValue] ⚠️ Closing tag not found for: ${paramName}`);
    }
  } else {
    console.warn(`[extractParamValue] ⚠️ Opening tag not found for: ${paramName}`);
  }

  // Fallback: Try regex-based extraction (legacy support)
  console.log(`[extractParamValue] Trying regex fallback for: ${paramName}`);
  const standardRegex = new RegExp(
    `<${paramName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${paramName}>`,
    "i",
  );
  const standardMatch = content.match(standardRegex);
  if (standardMatch) {
    console.log(`[extractParamValue] ✅ Regex fallback SUCCESS for: ${paramName}`);
    let value = standardMatch[1];
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    const decoded = decodeHtmlEntities(value);
    const result = isContentParam ? decoded.replace(/^\n|\n$/g, "") : decoded.trim();
    console.log(`[extractParamValue] Returning fallback value length: ${result.length}`);
    return result;
  }

  console.error(`[extractParamValue] ❌ FAILED to extract param: ${paramName}`);
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
