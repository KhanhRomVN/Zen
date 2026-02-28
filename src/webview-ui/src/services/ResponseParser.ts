export interface ParsedResponse {
  thinking: string | null;
  followupQuestion: string | null;
  followupOptions: string[] | null;
  taskName: string | null;
  taskProgress: TaskProgressItem[] | null;
  actions: ToolAction[];
  contentBlocks: ContentBlock[]; // New interleaved structure
  displayText: string;
  conversationName: string | null;
}

export interface TaskProgressItem {
  text: string;
  completed: boolean;
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
  taskProgress?: TaskProgressItem[] | null;
}

export type ContentBlock =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language?: string }
  | { type: "html"; content: string }
  | { type: "file"; content: string }
  | {
      type: "task_progress";
      taskName: string | null;
      taskSummary: string | null;
      items: TaskProgressItem[];
    }
  | { type: "markdown"; content: string }
  | { type: "tool"; action: ToolAction };

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
    let value = standardMatch[1].trim();
    // Remove ```text wrappers if present
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    return decodeHtmlEntities(value);
  }

  // Try self-closing tag with content
  const selfClosingRegex = new RegExp(
    `<${paramName}\\s*>([\\s\\S]*?)(?=<[\\w_]+>|$)`,
    "i",
  );
  const selfClosingMatch = content.match(selfClosingRegex);
  if (selfClosingMatch) {
    let value = selfClosingMatch[1].trim();
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    return decodeHtmlEntities(value);
  }
  return null;
};

/**
 * Parse task_progress content to extract checklist items
 */
const parseTaskProgress = (content: string): TaskProgressItem[] | null => {
  if (!content) {
    return null;
  }

  // Remove ```text wrappers
  const cleanContent = content.replace(/^```text\s*\n?|\n?```\s*$/g, "").trim();
  const items: TaskProgressItem[] = [];

  // 1. Try parsing XML-style tags: <task>, <task_done>, <task_todo>, etc. (Exclude name/summary)
  const taskTagRegex =
    /<task(?:_(done|todo|x))?(?:\s+status=["'](\w+)["'])?\s*>([\s\S]*?)<\/task(?:_\w+)?>/gi;
  let match;
  while ((match = taskTagRegex.exec(cleanContent)) !== null) {
    const taskType = match[1]?.toLowerCase();
    const status = match[2]?.toLowerCase();
    const text = match[3].trim();
    if (text) {
      items.push({
        completed:
          taskType === "done" ||
          status === "done" ||
          status === "completed" ||
          status === "x",
        text: text,
      });
    }
  }

  if (items.length > 0) {
    return items;
  }

  // 2. Fallback to Markdown checklist patterns:
  const lines = cleanContent.split("\n");
  for (const line of lines) {
    // - [x] Task
    // - [ ] Task
    // - [X] Task (uppercase)
    const checkboxMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
    if (checkboxMatch) {
      const item = {
        completed: checkboxMatch[1].toLowerCase() === "x",
        text: checkboxMatch[2].trim(),
      };
      items.push(item);
    }
  }

  return items.length > 0 ? items : null;
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
    taskProgress: null,
  };
};

/**
 * Parse AI response to extract thinking, task_progress, and tool actions
 * Supports interleaved text and tool calls
 */
export const parseAIResponse = (content: string): ParsedResponse => {
  const result: ParsedResponse = {
    thinking: null,
    followupQuestion: null,
    followupOptions: null,
    taskName: null,
    taskProgress: null,
    actions: [],
    contentBlocks: [],
    displayText: "",
    conversationName: null,
  };

  let remainingContent = content;

  // 1. Extract <thinking> content (Removed from flow)
  const thinkingMatch = remainingContent.match(
    /<thinking>([\s\S]*?)<\/thinking>/,
  );
  if (thinkingMatch) {
    result.thinking = thinkingMatch[1].trim();
    remainingContent = remainingContent.replace(thinkingMatch[0], "");
  }

  // 2. Extract global <task_progress> (Independent tag, Removed from flow)
  // Logic: Extract ALL task_progress tags and use the LAST one found (most recent state).
  const taskProgressMatches = [
    ...remainingContent.matchAll(/<task_progress>([\s\S]*?)<\/task_progress>/g),
  ];
  if (taskProgressMatches.length > 0) {
    // Use the last match
    const lastMatch = taskProgressMatches[taskProgressMatches.length - 1];
    const innerContent = lastMatch[1];
    result.taskProgress = parseTaskProgress(innerContent);

    // Extract task_name
    const taskNameMatch = innerContent.match(
      /<task_name>([\s\S]*?)<\/task_name>/i,
    );
    if (taskNameMatch) {
      result.taskName = taskNameMatch[1].trim();
    }

    // DO NOT remove task_progress from remainingContent here anymore,
    // as we want it to be processed by the interleaved scanner in Step 3
    // instead of being just a global property.
    // remainingContent = remainingContent.replace(/<task_progress>[\s\S]*?<\/task_progress>/g, "");
  }

  // Hide </no_response> markers
  remainingContent = remainingContent.replace(/<\/no_response\s*>/gi, "");

  // 3. Scan for tools and text blocks
  const toolPatterns = [
    "read_file",
    "write_to_file",
    "replace_in_file",
    "run_command",
    "list_files",
    "search_files",
    "execute_agent_action",
    "html_inline_css_block", // Treat <html_inline_css_block> as a special tag
    "text", // Treat <text> as a special tag
    "code", // Treat <code> as a special tag
    "file", // Treat <file> as a special tag
    "task_progress", // Treat <task_progress> as a special tag
    "markdown", // Treat <markdown> as a special tag
    "conversation_name", // Treat <conversation_name> as a special tag
  ];

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

    // 2. Try to find closed Markdown code blocks
    const codeBlockMatch = /```(\w*)\n([\s\S]*?)```/.exec(str);
    if (codeBlockMatch) {
      if (minIndex === -1 || codeBlockMatch.index < minIndex) {
        minIndex = codeBlockMatch.index;
        bestMatch = codeBlockMatch;
        bestTool = "markdown_code_block";
        isClosed = true;
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

    // 4. Check for unclosed Markdown code blocks
    const unclosedCodeMatch = /```(\w*)\n([\s\S]*)$/.exec(str);
    if (unclosedCodeMatch) {
      if (minIndex === -1 || unclosedCodeMatch.index < minIndex) {
        minIndex = unclosedCodeMatch.index;
        bestMatch = unclosedCodeMatch;
        bestTool = "markdown_code_block";
        isClosed = false;
      }
    }

    return { index: minIndex, match: bestMatch, toolName: bestTool, isClosed };
  };

  let scanStr = remainingContent;

  while (scanStr.length > 0) {
    const { index, match, toolName, isClosed } = findNextTag(scanStr);

    if (index !== -1 && match) {
      // Found a tag or code block
      // 1. Everything before the tag is text
      const prefix = scanStr.substring(0, index);
      if (prefix.trim()) {
        result.contentBlocks.push({ type: "text", content: prefix });
      }

      // 2. Handle the tag
      const rawXml = match[0];

      if (isClosed) {
        const innerContent = match[1];

        if (toolName === "markdown_code_block") {
          const language = match[1] || "text";
          // Remove trailing newline usually found before the closing backticks
          const content = match[2].replace(/\n$/, "");
          result.contentBlocks.push({
            type: "code",
            content: content,
            language: language,
          });
        } else if (toolName === "text") {
          if (innerContent && innerContent.trim()) {
            result.contentBlocks.push({ type: "text", content: innerContent });
          }
        } else if (toolName === "html_inline_css_block") {
          // Explicit <html_inline_css_block> tag
          if (innerContent && innerContent.trim()) {
            result.contentBlocks.push({
              type: "html",
              content: innerContent.trim(),
            });
          }
        } else if (toolName === "code") {
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
            result.contentBlocks.push({
              type: "markdown",
              content: innerContent.trim(),
            });
          }
        } else if (toolName === "task_progress") {
          // Explicit <task_progress> tag
          const items = parseTaskProgress(innerContent || "");
          const taskNameMatch = innerContent?.match(
            /<task_name>([\s\S]*?)<\/task_name>/i,
          );
          const taskName = taskNameMatch ? taskNameMatch[1].trim() : null;

          const taskSummaryMatch = innerContent?.match(
            /<task_summary>([\s\S]*?)<\/task_summary>/i,
          );
          const taskSummary = taskSummaryMatch
            ? taskSummaryMatch[1].trim()
            : null;

          if (items || taskName || taskSummary) {
            result.contentBlocks.push({
              type: "task_progress",
              taskName,
              taskSummary,
              items: items || [],
            });
            // Also update global for backward compatibility if needed
            result.taskProgress = items;
            result.taskName = taskName;
          }
        } else if (toolName === "conversation_name") {
          // Explicit <conversation_name> tag
          // Support both <conversation_name><value>Title</value></conversation_name>
          // and <conversation_name>Title</conversation_name>
          const valueFromTag = extractParamValue(innerContent || "", "value");
          if (valueFromTag) {
            result.conversationName = valueFromTag;
          } else if (innerContent && innerContent.trim()) {
            result.conversationName = innerContent.trim();
          }
        } else {
          // It's a tool
          const action = parseToolAction(toolName, innerContent || "", rawXml);
          result.contentBlocks.push({ type: "tool", action });
          result.actions.push(action); // Populate legacy actions array

          // Special handling for legacy fields (followup, completion) which were previously separate
          // These tools are now removed, so this block is no longer needed.
        }

        // 3. Advance scanStr
        scanStr = scanStr.substring(index + rawXml.length);
      } else {
        // Handle unclosed tags: capture content until EOF
        const innerContent = scanStr.substring(index + rawXml.length);

        if (toolName === "markdown_code_block") {
          result.contentBlocks.push({
            type: "code",
            content: innerContent,
            language: match[1] || "text",
          });
        } else if (toolName === "text") {
          // For <text> we show content even if unclosed
          if (innerContent.trim()) {
            result.contentBlocks.push({ type: "text", content: innerContent });
          }
        } else if (toolName === "task_progress") {
          // Update as we go even if unclosed
          const items = parseTaskProgress(innerContent || "");
          const taskNameMatch = innerContent?.match(
            /<task_name>([\s\S]*?)<\/task_name>/i,
          );
          const taskName = taskNameMatch ? taskNameMatch[1].trim() : null;

          const taskSummaryMatch = innerContent?.match(
            /<task_summary>([\s\S]*?)<\/task_summary>/i,
          );
          const taskSummary = taskSummaryMatch
            ? taskSummaryMatch[1].trim()
            : null;

          if (items || taskName || taskSummary) {
            result.contentBlocks.push({
              type: "task_progress",
              taskName,
              taskSummary,
              items: items || [],
            });
          }
        } else if (toolName === "markdown") {
          // For <markdown> we show content even if unclosed
          if (innerContent.trim()) {
            result.contentBlocks.push({
              type: "markdown",
              content: innerContent,
            });
          }
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
          result.contentBlocks.push({
            type: "text",
            content: textBeforePartial,
          });
        }
      } else {
        if (scanStr.trim()) {
          result.contentBlocks.push({ type: "text", content: scanStr });
        }
      }
      break;
    }
  }

  // Generate legacy displayText for fallback
  result.displayText = result.contentBlocks
    .filter((b) => b.type === "text")
    .map((b) => (b as any).content)
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
