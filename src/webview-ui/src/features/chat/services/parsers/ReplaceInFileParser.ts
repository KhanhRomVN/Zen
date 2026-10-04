import { extractParamValue } from "../../utils/ToolParser";

export interface ReplaceInFileParams {
  file_path: string;
  old_content: string;
  new_content: string;
  _validationError?: string;
  /** Tên tool gốc của claude trước khi convert (vd: "str_replace") */
  original_tool_name?: string;
  /** Sandbox path gốc của claude trước khi map về workspace */
  original_path?: string;
}

/**
 * Helper function to detect missing closing tag
 */
const detectMissingClosingTag = (
  content: string,
  paramName: string,
  alternativeNames: string[] = [],
): string | null => {
  const allNames = [paramName, ...alternativeNames];

  for (const name of allNames) {
    const openingTag = new RegExp(`<${name}(?:\\s+[^>]*)?>`, "i");
    const hasOpening = openingTag.test(content);

    if (hasOpening) {
      const closingTag = `</${name}>`;
      const hasClosing = content.includes(closingTag);

      if (!hasClosing) {
        return name; // Found opening but missing closing
      }
    }
  }

  return null;
};

export const parseReplaceInFile = (
  innerContent: string,
): ReplaceInFileParams => {
  // Parse according to tools-reference.ts schema: file_path, old_content, new_content
  let filePath = extractParamValue(innerContent, "file_path");
  let oldContent = extractParamValue(innerContent, "old_content");
  let newContent = extractParamValue(innerContent, "new_content");
  const originalToolName =
    extractParamValue(innerContent, "original_tool_name") || undefined;
  const originalPath =
    extractParamValue(innerContent, "original_path") || undefined;

  // Fallback: Try alternative tag names if standard ones don't work.
  // Use === null (not falsy check) so that an intentionally empty value like
  // <new_content></new_content> is NOT overwritten by a failed lookup of the
  // alternative tag name — "" is a valid result here.
  if (filePath === null) {
    filePath = extractParamValue(innerContent, "path");
  }

  if (oldContent === null) {
    oldContent = extractParamValue(innerContent, "old");
  }

  if (newContent === null) {
    newContent = extractParamValue(innerContent, "new");
  }

  // Additional fallback: Try to extract from plain text format
  // Format: file_path: <path>\nold_content: <content>\nnew_content: <content>
  // Only fires when a tag is genuinely absent (=== null), not when it's empty.
  if (filePath === null || oldContent === null || newContent === null) {
    const plainTextMatch = innerContent.match(/file_path:\s*([^\n]+)/i);
    if (plainTextMatch && filePath === null) {
      filePath = plainTextMatch[1].trim();
    }
  }

  // Check for missing closing tags with specific error messages.
  // Only probe when the tag is genuinely absent (=== null). An empty-but-present
  // value like "" must NOT trigger this branch — otherwise we'd misreport a
  // valid deletion as a malformed tag.
  const missingClosingTags: string[] = [];

  if (filePath === null) {
    const missingTag = detectMissingClosingTag(innerContent, "file_path", [
      "path",
    ]);
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }

  if (oldContent === null) {
    const missingTag = detectMissingClosingTag(innerContent, "old_content", [
      "old",
    ]);
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }

  if (newContent === null) {
    const missingTag = detectMissingClosingTag(innerContent, "new_content", [
      "new",
    ]);
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }

  // If missing closing tags detected, provide specific error
  if (missingClosingTags.length > 0) {
    const tagList = missingClosingTags.map((tag) => `</${tag}>`).join(", ");
    const errorMsg = `Missing closing tag(s): ${tagList}`;

    console.error("[Zen][ReplaceInFileParser] Validation error:", {
      missingClosingTags,
      error: errorMsg,
      innerContent: innerContent.substring(0, 200), // Log first 200 chars for debug
    });

    return {
      file_path: filePath || "",
      old_content: oldContent || "",
      new_content: newContent || "",
      _validationError: errorMsg,
    };
  }

  // Validate required parameters (for cases where tags don't exist at all)
  // Note: distinguish null (tag absent) from "" (tag present but empty).
  // An empty <new_content></new_content> is a legitimate "delete this snippet"
  // operation, so it must NOT be treated as missing. Same reasoning for
  // <old_content> in theory, though replacing an empty string is rarely useful —
  // we still allow it to keep the parser consistent with extractParamValue's contract.
  const missingParams: string[] = [];
  if (!filePath || filePath.trim() === "") {
    missingParams.push("file_path");
  }
  if (oldContent === null) {
    missingParams.push("old_content");
  }
  if (newContent === null) {
    missingParams.push("new_content");
  }

  // If any required param is missing, return error
  if (missingParams.length > 0) {
    const errorMsg = `Missing required parameter(s): ${missingParams.join(", ")}`;

    console.error("[Zen][ReplaceInFileParser] Validation error:", {
      missingParams,
      error: errorMsg,
      innerContent: innerContent.substring(0, 200), // Log first 200 chars for debug
    });

    return {
      file_path: filePath || "",
      old_content: oldContent || "",
      new_content: newContent || "",
      _validationError: errorMsg,
    };
  }

  return {
    file_path: filePath || "",
    old_content: oldContent || "",
    new_content: newContent || "",
    original_tool_name: originalToolName,
    original_path: originalPath,
  };
};
