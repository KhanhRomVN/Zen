import { extractParamValue } from "../../utils/ToolParser";

export interface ReplaceInFileParams {
  file_path: string;
  old_content: string;
  new_content: string;
}

export const parseReplaceInFile = (
  innerContent: string,
): ReplaceInFileParams => {
  console.log("===================================");
  console.log("🔧 [parseReplaceInFile] Starting new replace_in_file parse");
  console.log("===================================");
  
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

  console.log("📋 [parseReplaceInFile] Parse results:");
  console.log(`  ✓ file_path: ${filePath ? `"${filePath}"` : "❌ MISSING"}`);
  console.log(`  ✓ old_content length: ${oldContent ? oldContent.length : "❌ MISSING"}`);
  console.log(`  ✓ new_content length: ${newContent ? newContent.length : "❌ MISSING"}`);
  console.log("===================================\n");

  return {
    file_path: filePath || "",
    old_content: oldContent || "",
    new_content: newContent || "",
  };
};
