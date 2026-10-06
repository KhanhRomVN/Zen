/**
 * UpdateMemoryParser — parse <update_memory> tag.
 * Schema: <update_memory><old_content>...</old_content><new_content>...</new_content></update_memory>
 * Tương tự ReplaceInFileParser nhưng không có file_path (luôn trỏ memory.md).
 * new_content được phép rỗng khi lần đầu khởi tạo file.
 */

import { extractParamValue } from "../../utils/ToolParser";

export interface UpdateMemoryParams {
  old_content: string;
  new_content: string;
  _validationError?: string;
}

const detectMissingClosingTag = (
  content: string,
  paramName: string,
): string | null => {
  const openingTag = new RegExp(`<${paramName}(?:\\s+[^>]*)?>`, "i");
  if (!openingTag.test(content)) return null;
  const closingTag = `</${paramName}>`;
  return content.includes(closingTag) ? null : paramName;
};

export const parseUpdateMemory = (
  innerContent: string,
): UpdateMemoryParams => {
  let oldContent = extractParamValue(innerContent, "old_content");
  let newContent = extractParamValue(innerContent, "new_content");

  // Fallback alias
  if (oldContent === null) oldContent = extractParamValue(innerContent, "old");
  if (newContent === null) newContent = extractParamValue(innerContent, "new");

  const missingClosingTags: string[] = [];
  if (oldContent === null) {
    const t = detectMissingClosingTag(innerContent, "old_content");
    if (t) missingClosingTags.push(t);
  }
  if (newContent === null) {
    const t = detectMissingClosingTag(innerContent, "new_content");
    if (t) missingClosingTags.push(t);
  }

  if (missingClosingTags.length > 0) {
    const tagList = missingClosingTags.map((tag) => `</${tag}>`).join(", ");
    const errorMsg = `Missing closing tag(s): ${tagList}`;
    console.error("[Zen][UpdateMemoryParser] Validation error:", {
      missingClosingTags,
      error: errorMsg,
      innerContent: innerContent.substring(0, 200),
    });
    return {
      old_content: oldContent || "",
      new_content: newContent || "",
      _validationError: errorMsg,
    };
  }

  const missingParams: string[] = [];
  if (oldContent === null) missingParams.push("old_content");
  if (newContent === null) missingParams.push("new_content");

  if (missingParams.length > 0) {
    const errorMsg = `Missing required parameter(s): ${missingParams.join(", ")}`;
    console.error("[Zen][UpdateMemoryParser] Validation error:", {
      missingParams,
      error: errorMsg,
      innerContent: innerContent.substring(0, 200),
    });
    return {
      old_content: oldContent || "",
      new_content: newContent || "",
      _validationError: errorMsg,
    };
  }

  return {
    old_content: oldContent || "",
    new_content: newContent || "",
  };
};