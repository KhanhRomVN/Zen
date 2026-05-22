export interface ParsedResponse {
  followupQuestion: string | null;
  followupOptions: string[] | null;
  taskName: string | null;
  actions: ToolAction[];
  contentBlocks: ContentBlock[];
  displayText: string;
  question: ContentBlock | null;
}

export interface ToolAction {
  type:
    | "read_file"
    | "write_to_file"
    | "replace_in_file"
    | "list_files"
    | "search_files"
    | "run_command"
    | "execute_agent_action";
  params: Record<string, any>;
  rawXml: string;
  isPartial?: boolean;
}

export type ContentBlock =
  | { type: "code"; content: string; language?: string }
  | { type: "html"; content: string }
  | { type: "file"; content: string }
  | { type: "markdown"; content: string }
  | { type: "question"; options: string[]; title?: string; optional?: boolean }
  | {
      type: "mixed_content";
      segments: (
        | { type: "markdown"; content: string }
        | { type: "code"; content: string; language?: string }
      )[];
    }
  | { type: "tool"; action: ToolAction; actionIndex?: number };

/**
 * Decode common HTML entities back to their original characters
 */
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

/**
 * Parse XML-like content to extract parameter value
 */
const extractParamValue = (
  content: string,
  paramName: string,
): string | null => {
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
    return decodeHtmlEntities(value).trim();
  }

  // Try self-closing tag with content
  const selfClosingRegex = new RegExp(
    `<${paramName}\\s*>([\\s\\S]*?)(?=<[\\w_]+>|$)`,
    "i",
  );
  const selfClosingMatch = content.match(selfClosingRegex);
  if (selfClosingMatch) {
    let value = selfClosingMatch[1];
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    let decoded = decodeHtmlEntities(value).trim();
    // Strip malformed closing tag suffix like /paramName> or paramName>
    const malformedCloseRegex = new RegExp(`/?${paramName}>?$`, "i");
    decoded = decoded.replace(malformedCloseRegex, "").trim();
    return decoded;
  }
  return null;
};


/**
 * Extract tool actions from inner content
 */
const parseToolAction = (
  toolName: string,
  innerContent: string,
  rawXml: string,
): ToolAction => {
  const params: Record<string, any> = {};

  // Extract specific parameters based on tool type
  switch (toolName) {
    case "read_file":
      params.file_path = extractParamValue(innerContent, "file_path");
      params.start_line = extractParamValue(innerContent, "start_line");
      params.end_line = extractParamValue(innerContent, "end_line");
      break;

    case "write_to_file":
      params.file_path = extractParamValue(innerContent, "file_path");
      params.content = extractParamValue(innerContent, "content");
      break;

    case "replace_in_file":
      params.file_path = extractParamValue(innerContent, "file_path");
      params.diff = extractParamValue(innerContent, "diff");
      break;
    case "run_command":
      params.command = extractParamValue(innerContent, "command");
      params.terminal_id = extractParamValue(innerContent, "terminal_id");
      params.cwd = extractParamValue(innerContent, "cwd");
      break;
    case "execute_agent_action":
      // No special param handling needed yet
      break;

    case "list_files":
      params.folder_path = extractParamValue(innerContent, "folder_path");
      params.depth = extractParamValue(innerContent, "depth");
      params.recursive = extractParamValue(innerContent, "recursive"); // Keep as string, handle in extension (e.g. "true", "false", "1", "2")
      params.type = extractParamValue(innerContent, "type");
      break;

    case "search_files":
      params.folder_path = extractParamValue(innerContent, "folder_path");
      params.regex = extractParamValue(innerContent, "regex");
      params.file_pattern = extractParamValue(innerContent, "file_pattern");
      break;
  }

  return {
    type: toolName as any,
    params,
    rawXml,
  };
};

/**
 * Parse AI response to extract tool actions
 * Supports interleaved text and tool calls
 */
export const parseAIResponse = (content: string): ParsedResponse => {
  const result: ParsedResponse = {
    followupQuestion: null,
    followupOptions: null,
    taskName: null,
    actions: [],
    contentBlocks: [],
    displayText: "",
    question: null,
  };

  let remainingContent = content;

  // Hide </no_response> markers
  remainingContent = remainingContent.replace(/<\/no_response\s*>/gi, "");

  // Scan for tools and text blocks
  const toolPatterns = [
    "read_file",
    "write_to_file",
    "replace_in_file",
    "run_command",
    "list_files",
    "search_files",
    "execute_agent_action",
    "code",
    "file",
    "markdown",
    "question",
  ];

  // Fix missing opening bracket for the first tool call due to prefix/prefill stripping.
  // Use only horizontal whitespace (\t, space) — NOT \n — and no 'i' flag to avoid
  // accidentally eating the first character of normal text (e.g. "Dựa trên...").
  const toolNamesPattern = toolPatterns.join("|");
  const missingBracketRegex = new RegExp(
    `^([ \t]*(?:•[ \t]*)?)(${toolNamesPattern})>`,
  );
  if (missingBracketRegex.test(remainingContent)) {
    remainingContent = remainingContent.replace(
      missingBracketRegex,
      "$1<$2>",
    );
  }

  // We need to parse linearly to maintain order
  // Strategy: Find the first occurrence of ANY tool tag OR markdown code block

  // Helper to find next tag
  const findNextTag = (str: string) => {
    let minIndex = -1;
    let bestMatch: any = null;
    let bestTool = "";
    let isClosed = false;

    // 1. Try to find complete (closed) tags first
    for (const toolName of toolPatterns) {
      let closingTagPattern = toolName;
      if (toolName === "read_file") {
        closingTagPattern = "read_files?";
      }

      const regex = new RegExp(
        `<${toolName}(?:\\s+[^>]*)?\\s*(?:>([\\s\\S]*?)<\\/${closingTagPattern}\\s*>|\\/>)`,
        "i",
      );
      const match = regex.exec(str);

      if (match) {
        if (minIndex === -1 || match.index < minIndex) {
          minIndex = match.index;
          bestMatch = match;
          bestTool = toolName;
          isClosed = true;
        }
      }
    }

    // 3. If no closed tag/block found at a closer position, check for unclosed start tags
    for (const toolName of toolPatterns) {
      const openRegex = new RegExp(`<${toolName}(?:\\s+[^>]*)?>`, "i");
      const match = openRegex.exec(str);
      if (match) {
        if (minIndex === -1 || match.index < minIndex) {
          minIndex = match.index;
          bestMatch = match;
          bestTool = toolName;
          isClosed = false;
        }
      }
    }

    return { index: minIndex, match: bestMatch, toolName: bestTool, isClosed };
  };

  const pushTextOrCodeBlocks = (baseType: "markdown", content: string) => {
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    const segments: any[] = [];

    while ((match = regex.exec(content)) !== null) {
      const textBefore = content.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push({ type: baseType, content: textBefore });
      }

      const language = match[1] || "text";
      const codeContent = match[2].trimEnd();
      // If AI wraps content in ```markdown ... ```, treat it as markdown, not a code block
      // Also treat bare ``` or ```text with no-newline content as markdown
      if (language === "markdown" || (language === "text" && !codeContent.includes("\n"))) {
        segments.push({ type: baseType, content: codeContent });
      } else {
        segments.push({
          type: "code",
          content: codeContent,
          language: language,
        });
      }

      lastIndex = regex.lastIndex;
    }

    const textAfter = content.substring(lastIndex);
    if (textAfter.trim()) {
      segments.push({ type: baseType, content: textAfter });
    }

    if (segments.length === 1 && segments[0].type !== "code") {
      result.contentBlocks.push(segments[0]);
    } else if (segments.length > 0) {
      result.contentBlocks.push({ type: "mixed_content", segments });
    }
  };

  let scanStr = remainingContent;

  while (scanStr.length > 0) {
    const { index, match, toolName, isClosed } = findNextTag(scanStr);

    if (index !== -1 && match) {
      // Found a tag
      // 1. Everything before the tag is markdown
      const prefix = scanStr.substring(0, index);
      if (prefix.trim()) {
        pushTextOrCodeBlocks("markdown", prefix);
      }

      // 2. Handle the tag
      const rawXml = match[0];

      if (isClosed) {
        const innerContent = match[1];

        if (toolName === "code") {
          // Explicit <code> tag
          const languageFn = extractParamValue(innerContent || "", "language");
          const contentFn = extractParamValue(innerContent || "", "content");

          if (contentFn) {
            result.contentBlocks.push({
              type: "code",
              content: contentFn,
              language: languageFn || "text",
            });
          }
        } else if (toolName === "file") {
          // Explicit <file> tag
          if (innerContent && innerContent.trim()) {
            result.contentBlocks.push({
              type: "file",
              content: innerContent.trim(),
            });
          }
        } else if (toolName === "markdown") {
          // Explicit <markdown> tag
          if (innerContent && innerContent.trim()) {
            pushTextOrCodeBlocks("markdown", innerContent.trim());
          }
        } else if (toolName === "question") {
          // Explicit <question> tag
          const options: string[] = [];
          let title: string | undefined = undefined;

          // Extract title if present
          const titleMatch =
            /<question_title>([\s\S]*?)<\/question_title>/i.exec(
              innerContent || "",
            );
          if (titleMatch) {
            title = titleMatch[1].trim();
          }

          const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
          let optMatch;
          while ((optMatch = optionRegex.exec(innerContent || "")) !== null) {
            if (optMatch[1].trim()) {
              options.push(optMatch[1].trim());
            }
          }
          if (options.length > 0) {
            const openTag = match[0].split(">")[0];
            const optional = /optional=["']true["']/i.test(openTag);
            const qBlock: ContentBlock = {
              type: "question",
              options,
              title,
              optional,
            };
            result.contentBlocks.push(qBlock);
            result.question = qBlock;
            // Also populate legacy for compatibility
            result.followupOptions = options;
          }
        } else {
          // It's a tool
          const actionIndex = result.actions.length;
          const action = parseToolAction(toolName, innerContent || "", rawXml);
          result.contentBlocks.push({ type: "tool", action, actionIndex });
          result.actions.push(action); // Populate legacy actions array
        }

        // 3. Advance scanStr
        scanStr = scanStr.substring(index + rawXml.length);
      } else {
        // Handle unclosed tags: capture content until EOF
        const innerContent = scanStr.substring(index + rawXml.length);

        if (toolName === "markdown") {
          // For <markdown> we show content even if unclosed
          if (innerContent.trim()) {
            result.contentBlocks.push({
              type: "markdown",
              content: innerContent,
            });
          }
        } else if (
          toolName !== "code" &&
          toolName !== "file" &&
          toolName !== "conversation_name"
        ) {
          // It's a tool, let it stream!
          const actionIndex = result.actions.length;
          const action = parseToolAction(toolName, innerContent || "", rawXml);
          action.isPartial = true;
          result.contentBlocks.push({ type: "tool", action, actionIndex });
          result.actions.push(action);
        } else {
          // For tools, hide entire content including XML until closed
        }
        break; // Stop scanning as we've consumed or hidden till end
      }
    } else {
      // No more tags, but check for partial tag prefix at the very end (e.g., "<tex")
      const partialTagMatch = /<[\/]?[a-zA-Z0-9_]*$/.exec(scanStr);
      if (partialTagMatch) {
        const textBeforePartial = scanStr.substring(0, partialTagMatch.index);
        if (textBeforePartial.trim()) {
          pushTextOrCodeBlocks("markdown", textBeforePartial);
        }
      } else {
        if (scanStr.trim()) {
          pushTextOrCodeBlocks("markdown", scanStr);
        }
      }
      break;
    }
  }

  // Generate legacy displayText for fallback
  result.displayText = result.contentBlocks
    .filter((b: any) => b.type === "markdown")
    .map((b: any) => (b as any).content)
    .join("\n\n");

  return result;
};

/**
 * Format tool action for display
 */
export const formatActionForDisplay = (action: ToolAction): string => {
  switch (action.type) {
    case "read_file":
      const range =
        action.params.start_line && action.params.end_line
          ? ` (${action.params.start_line}-${action.params.end_line})`
          : "";
      return `read_file: ${action.params.file_path || "unknown"}${range}`;

    case "write_to_file":
      return `write_to_file: ${action.params.file_path || "unknown"}`;

    case "replace_in_file":
      return `replace_in_file: ${action.params.file_path || "unknown"}`;

    case "run_command":
      return `Run: ${action.params.command || ""}`;
    case "execute_agent_action":
      return `Agent: ${action.params.action || "Execute"}`;

    case "list_files":
      const type = action.params.type ? ` [${action.params.type}]` : "";
      return `list_files: ${action.params.folder_path || "unknown"}${type}`;

    case "search_files":
      return `search_files: ${action.params.regex || "unknown"}`;

    default:
      return ``;
  }
};

/**
 * Get detailed info for action modal/tooltip
 */
export const getActionDetails = (action: ToolAction): string => {
  const lines: string[] = [];

  lines.push(`Tool: ${action.type}`);
  lines.push("");

  // Format parameters
  Object.entries(action.params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (typeof value === "string" && value.length > 200) {
        lines.push(`${key}: ${value.substring(0, 200)}...`);
      } else if (typeof value === "object") {
        lines.push(`${key}: ${JSON.stringify(value, null, 2)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  });

  return lines.join("\n");
};
