import { extractParamValue } from "../../utils/ToolParser";

// Enable debug logs via localStorage
const DEBUG_PARSER =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("zen_debug_parser") === "true";

export interface WriteToFileParams {
  file_path: string;
  content: string;
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

export const parseWriteToFile = (
  innerContent: string,
): WriteToFileParams & { isError?: boolean; errorMessage?: string } => {
  // Parse according to tools-reference.ts schema: file_path and content
  const filePath = extractParamValue(innerContent, "file_path");
  const content = extractParamValue(innerContent, "content");

  // Check for missing closing tags with specific error messages
  const missingClosingTags: string[] = [];
  
  if (!filePath) {
    const missingTag = detectMissingClosingTag(innerContent, "file_path", ["path"]);
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }
  
  if (!content) {
    const missingTag = detectMissingClosingTag(innerContent, "content");
    if (missingTag) {
      missingClosingTags.push(missingTag);
    }
  }

  // If missing closing tags detected, provide specific error
  if (missingClosingTags.length > 0) {
    if (DEBUG_PARSER) {
      console.warn(
        `[Zen][WriteToFileParser] ⚠️ Missing closing tags: ${missingClosingTags.join(", ")}`,
      );
    }
    return {
      file_path: filePath || "",
      content: content || "",
      isError: true,
      errorMessage: `Missing closing tag(s): ${missingClosingTags.map(tag => `</${tag}>`).join(", ")}`,
    };
  }

  // Validate required parameters (for cases where tags don't exist at all)
  const missingParams: string[] = [];
  if (!filePath || filePath.trim() === "") {
    missingParams.push("file_path");
  }
  if (!content || content.trim() === "") {
    missingParams.push("content");
  }

  // If any required param is missing, return error
  if (missingParams.length > 0) {
    if (DEBUG_PARSER) {
      console.warn(
        `[Zen][WriteToFileParser] ⚠️ Missing parameters: ${missingParams.join(", ")}`,
      );
    }
    return {
      file_path: filePath || "",
      content: content || "",
      isError: true,
      errorMessage: `Missing required parameter(s): ${missingParams.join(", ")}`,
    };
  }

  return {
    file_path: filePath || "",
    content: content || "",
  };
};
