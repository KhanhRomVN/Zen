import { extractParamValue } from "../../utils/ToolParser";

export interface ReplaceInFileParams {
  file_path: string;
  old_content: string;
  new_content: string;
  _validationError?: string; // Internal flag for validation errors
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

  // Fallback: Try alternative tag names if standard ones don't work
  if (!filePath) {
    filePath = extractParamValue(innerContent, "path");
  }

  if (!oldContent) {
    oldContent = extractParamValue(innerContent, "old");
  }

  if (!newContent) {
    newContent = extractParamValue(innerContent, "new");
  }

  // Additional fallback: Try to extract from plain text format
  // Format: file_path: <path>\nold_content: <content>\nnew_content: <content>
  if (!filePath || !oldContent || !newContent) {
    const plainTextMatch = innerContent.match(/file_path:\s*([^\n]+)/i);
    if (plainTextMatch && !filePath) {
      filePath = plainTextMatch[1].trim();
    }
  }

  // Check for missing closing tags with specific error messages
  const missingClosingTags: string[] = [];

  if (!filePath) {
    const missingTag = detectMissingClosingTag(innerContent, "file_path", ["path"]);
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }

  if (!oldContent) {
    const missingTag = detectMissingClosingTag(innerContent, "old_content", ["old"]);
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }

  if (!newContent) {
    const missingTag = detectMissingClosingTag(innerContent, "new_content", ["new"]);
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }

  // If missing closing tags detected, provide specific error
  if (missingClosingTags.length > 0) {
    const tagList = missingClosingTags.map(tag => `</${tag}>`).join(", ");
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
  const missingParams: string[] = [];
  if (!filePath || filePath.trim() === "") {
    missingParams.push("file_path");
  }
  if (!oldContent || oldContent.trim() === "") {
    missingParams.push("old_content");
  }
  if (!newContent || newContent.trim() === "") {
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
  };
};
