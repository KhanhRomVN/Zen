import { decodeHtmlEntities } from "./TagNormalizer";
import type { ToolAction } from "../ResponseParser";

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

  // Try self-closing tag with content
  // Lookahead stops at any opening tag (<word>) OR any closing tag (</word>) OR end-of-string.
  // This handles mismatched tag names, e.g. <filePath>...</file_path>.
  const selfClosingRegex = new RegExp(
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

export const parseToolAction = (
  toolName: string,
  innerContent: string,
  rawXml: string,
): ToolAction => {
  const params: Record<string, any> = {};

  switch (toolName) {
    case "read_file":
      params.file_path = extractParam(
        innerContent,
        "file_path",
        "filePath",
        "filepath",
        "path",
      );
      params.start_line = extractParam(innerContent, "start_line", "startLine");
      params.end_line = extractParam(innerContent, "end_line", "endLine");
      break;

    case "write_to_file":
      params.file_path = extractParam(
        innerContent,
        "file_path",
        "filePath",
        "filepath",
        "path",
      );
      params.content = extractParamValue(innerContent, "content");
      break;

    case "replace_in_file":
      params.file_path = extractParam(
        innerContent,
        "file_path",
        "filePath",
        "filepath",
        "path",
      );
      params.diff = extractParamValue(innerContent, "diff");
      break;

    case "run_command":
      params.command = extractParamValue(innerContent, "command");
      params.terminal_id = extractParam(
        innerContent,
        "terminal_id",
        "terminalId",
      );
      params.cwd = extractParamValue(innerContent, "cwd");
      break;

    case "execute_agent_action":
      // No special param handling needed yet
      break;

    case "list_files":
      params.folder_path = extractParam(
        innerContent,
        "folder_path",
        "folderPath",
        "path",
      );
      params.depth = extractParamValue(innerContent, "depth");
      params.recursive = extractParamValue(innerContent, "recursive");
      params.type = extractParamValue(innerContent, "type");
      break;

    case "search_files":
      params.folder_path = extractParam(
        innerContent,
        "folder_path",
        "folderPath",
        "path",
      );
      params.regex = extractParamValue(innerContent, "regex");
      params.file_pattern = extractParam(
        innerContent,
        "file_pattern",
        "filePattern",
      );
      break;

    case "search_content":
    case "get_outline":
    case "get_definition":
    case "get_references":
      // removed tools — ignore
      break;

    case "delete_file":
      params.file_path = extractParam(
        innerContent,
        "file_path",
        "filePath",
        "filepath",
        "path",
      );
      break;

    case "delete_folder":
      params.folder_path = extractParam(
        innerContent,
        "folder_path",
        "folderPath",
        "path",
      );
      break;

    case "move_file":
      params.file_path = extractParam(
        innerContent,
        "file_path",
        "filePath",
        "filepath",
        "source_path",
        "sourcePath",
        "path",
      );
      params.target_folder_path = extractParam(
        innerContent,
        "target_folder_path",
        "targetFolderPath",
        "target_folder",
        "targetFolder",
        "destination",
        "dest",
        "to",
      );
      break;

    case "grep":
      params.search_term = extractParam(
        innerContent,
        "search_term",
        "searchTerm",
      );
      params.file_path = extractParam(
        innerContent,
        "file_path",
        "filePath",
        "filepath",
      );
      params.folder_path = extractParam(
        innerContent,
        "folder_path",
        "folderPath",
      );
      break;
    case "git_status":
      // Extract items as JSON string
      const itemsParam = extractParam(innerContent, "items");
      if (itemsParam) {
        params.items = itemsParam;
      }
      // Extract raw output
      const rawParam = extractParam(innerContent, "raw");
      if (rawParam) {
        params.raw = rawParam;
      }
      break;
    case "commit_message":
      // Extract commit message content
      const messageParam = extractParam(innerContent, "message");
      if (messageParam) {
        params.message = messageParam;
      }
      // Or get the full content if no specific param
      if (!params.message && innerContent.trim()) {
        params.message = innerContent.trim();
      }
      break;
  }

  return {
    type: toolName as any,
    params,
    rawXml,
  };
};
