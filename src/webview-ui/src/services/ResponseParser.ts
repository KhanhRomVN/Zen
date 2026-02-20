export interface ParsedResponse {
  thinking: string | null;
  followupQuestion: string | null;
  followupOptions: string[] | null;
  attemptCompletion: string | null;
  taskName: string | null;
  taskProgress: TaskProgressItem[] | null;
  actions: ToolAction[];
  contentBlocks: ContentBlock[]; // New interleaved structure
  displayText: string;
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
    | "execute_command"
    | "list_files"
    | "search_files"
    | "list_terminals"
    | "remove_terminal"
    | "stop_terminal"
    | "input_to_terminal"
    | "create_terminal_shell"
    | "read_terminal_logs"
    | "ask_followup_question"
    | "attempt_completion"
    | "update_codebase_context";
  params: Record<string, any>;
  rawXml: string;
  taskProgress?: TaskProgressItem[] | null;
}

export type ContentBlock =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language?: string }
  | { type: "html"; content: string }
  | { type: "file"; content: string }
  | { type: "tool"; action: ToolAction };

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
    return value;
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
    return value;
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

  // 1. Try parsing XML <task> tags first
  const taskTagRegex =
    /<task(?:\s+status=["'](\w+)["'])?\s*>([\s\S]*?)<\/task>/gi;
  let match;
  while ((match = taskTagRegex.exec(cleanContent)) !== null) {
    const status = match[1]?.toLowerCase();
    const text = match[2].trim();
    if (text) {
      items.push({
        completed:
          status === "done" || status === "completed" || status === "x",
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
      params.path = extractParamValue(innerContent, "path");
      params.start_line = extractParamValue(innerContent, "start_line");
      params.end_line = extractParamValue(innerContent, "end_line");
      break;

    case "write_to_file":
      params.path = extractParamValue(innerContent, "path");
      params.content = extractParamValue(innerContent, "content");
      break;

    case "replace_in_file":
      params.path = extractParamValue(innerContent, "path");
      params.diff = extractParamValue(innerContent, "diff");
      break;

    case "execute_command":
      params.command = extractParamValue(innerContent, "command");
      params.terminal_id = extractParamValue(innerContent, "terminal_id");
      break;

    case "list_terminals":
      // No params
      break;

    case "remove_terminal":
    case "stop_terminal":
    case "create_terminal_shell":
    case "read_terminal_logs":
      params.terminal_id = extractParamValue(innerContent, "terminal_id");
      break;

    case "input_to_terminal":
      params.terminal_id = extractParamValue(innerContent, "terminal_id");
      params.text = extractParamValue(innerContent, "text");
      break;

    case "list_files":
      params.path = extractParamValue(innerContent, "path");
      params.recursive = extractParamValue(innerContent, "recursive"); // Keep as string, handle in extension (e.g. "true", "false", "1", "2")
      params.type = extractParamValue(innerContent, "type");
      break;

    case "search_files":
      params.path = extractParamValue(innerContent, "path");
      params.regex = extractParamValue(innerContent, "regex");
      params.file_pattern = extractParamValue(innerContent, "file_pattern");
      break;

    case "ask_followup_question":
      params.question = extractParamValue(innerContent, "question");
      const optionsStr = extractParamValue(innerContent, "options");
      if (optionsStr) {
        try {
          params.options = JSON.parse(optionsStr);
        } catch {
          params.options = null;
        }
      }
      break;

    case "attempt_completion":
      params.result = extractParamValue(innerContent, "result");
      params.command = extractParamValue(innerContent, "command");
      break;

    case "update_codebase_context":
      params.projectName = extractParamValue(innerContent, "projectName");
      params.language = extractParamValue(innerContent, "language");
      params.description = extractParamValue(innerContent, "description");
      params.keyFiles = extractParamValue(innerContent, "keyFiles");
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
 * Helper to parse text for Markdown code blocks
 */
const parseTextWithCodeBlocks = (text: string): ContentBlock[] => {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textContent = text.substring(lastIndex, match.index);
      if (textContent.trim()) {
        blocks.push({ type: "text", content: textContent });
      }
    }

    // Add the code block
    const language = match[1] || "text";
    const content = match[2];
    blocks.push({
      type: "code",
      content: content,
      language: language,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex);
    if (textContent.trim()) {
      blocks.push({ type: "text", content: textContent });
    }
  }

  return blocks;
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
    attemptCompletion: null,
    taskName: null,
    taskProgress: null,
    actions: [],
    contentBlocks: [],
    displayText: "",
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

    // Remove all task_progress tags from content to avoid cluttering text blocks
    remainingContent = remainingContent.replace(
      /<task_progress>[\s\S]*?<\/task_progress>/g,
      "",
    );
  }

  // Hide <temp> tags
  remainingContent = remainingContent.replace(
    /<temp\s*>([\s\S]*?)<\/temp>/gi,
    "",
  );

  // 3. Scan for tools and text blocks
  const toolPatterns = [
    "read_file",
    "write_to_file",
    "replace_in_file",
    "execute_command",
    "list_files",
    "search_files",
    "execute_command",
    "list_terminals",
    "remove_terminal",
    "stop_terminal",
    "input_to_terminal",
    "create_terminal_shell",
    "read_terminal_logs",
    "ask_followup_question",
    "attempt_completion",
    "update_codebase_context",
    "html_inline_css_block", // Treat <html_inline_css_block> as a special tag
    "text", // Treat <text> as a special tag
    "code", // Treat <code> as a special tag
    "file", // Treat <file> as a special tag
  ];

  // We need to parse linearly to maintain order
  // Strategy: Find the first occurrence of ANY tool tag

  // Helper to find next tag
  const findNextTag = (str: string) => {
    let minIndex = -1;
    let bestMatch: RegExpExecArray | null = null;
    let bestTool = "";

    for (const toolName of toolPatterns) {
      let closingTagPattern = toolName;
      if (toolName === "read_file") {
        closingTagPattern = "read_files?";
      }

      // Support both <tool>content</tool> and <tool />
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
        }
      }
    }
    return { index: minIndex, match: bestMatch, toolName: bestTool };
  };

  let currentText = "";
  let scanStr = remainingContent;

  while (scanStr.length > 0) {
    const { index, match, toolName } = findNextTag(scanStr);

    if (index !== -1 && match) {
      // Found a tag
      // 1. Everything before the tag is text (PARSE FOR CODE BLOCKS)
      const prefix = scanStr.substring(0, index);
      if (prefix.trim()) {
        const textBlocks = parseTextWithCodeBlocks(prefix);
        result.contentBlocks.push(...textBlocks);
      }

      // 2. Handle the tag
      const rawXml = match[0];
      const innerContent = match[1];

      if (toolName === "text") {
        // Explicit <text> tag (Also parse content)
        if (innerContent.trim()) {
          const textBlocks = parseTextWithCodeBlocks(innerContent.trim());
          result.contentBlocks.push(...textBlocks);
        }
      } else if (toolName === "html_inline_css_block") {
        // Explicit <html_inline_css_block> tag
        if (innerContent.trim()) {
          result.contentBlocks.push({
            type: "html",
            content: innerContent.trim(),
          });
        }
      } else if (toolName === "code") {
        // Explicit <code> tag
        const languageFn = extractParamValue(innerContent, "language");
        const contentFn = extractParamValue(innerContent, "content");
        // Or if content is just innerContent? The code above used extractParamValue
        // Let's stick to existing logic for explicit tags but improve if needed
        // Actually, existing logic for explicit <code> is fine.

        if (contentFn) {
          result.contentBlocks.push({
            type: "code",
            content: contentFn,
            language: languageFn || "text",
          });
        }
      } else if (toolName === "file") {
        // Explicit <file> tag
        if (innerContent.trim()) {
          result.contentBlocks.push({
            type: "file",
            content: innerContent.trim(),
          });
        }
      } else {
        // It's a tool
        const action = parseToolAction(toolName, innerContent, rawXml);
        result.contentBlocks.push({ type: "tool", action });
        result.actions.push(action); // Populate legacy actions array

        // Special handling for legacy fields (followup, completion) which were previously separate
        if (toolName === "ask_followup_question") {
          result.followupQuestion = action.params.question;
          result.followupOptions = action.params.options;
        } else if (toolName === "attempt_completion") {
          result.attemptCompletion = action.params.result;
        }
      }

      // 3. Advance scanStr
      scanStr = scanStr.substring(index + rawXml.length);
    } else {
      // No more tags, the rest is text (PARSE FOR CODE BLOCKS)
      if (scanStr.trim()) {
        const textBlocks = parseTextWithCodeBlocks(scanStr);
        result.contentBlocks.push(...textBlocks);
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
      return `read_file: ${action.params.path || "unknown"}${range}`;

    case "write_to_file":
      return `write_to_file: ${action.params.path || "unknown"}`;

    case "replace_in_file":
      return `replace_in_file: ${action.params.path || "unknown"}`;

    case "execute_command":
      const termId = action.params.terminal_id
        ? ` (terminal: ${action.params.terminal_id})`
        : "";
      return `execute_command: ${action.params.command || "unknown"}${termId}`;

    case "list_terminals":
      return `list_terminals`;

    case "remove_terminal":
      return `remove_terminal: ${action.params.terminal_id || "unknown"}`;

    case "stop_terminal":
      return `stop_terminal: ${action.params.terminal_id || "unknown"}`;

    case "input_to_terminal":
      return `input_to_terminal: ${action.params.terminal_id || "unknown"}`;

    case "create_terminal_shell":
      return `create_terminal_shell: ${action.params.terminal_id || "unknown"}`;

    case "read_terminal_logs":
      return `read_terminal_logs: ${action.params.terminal_id || "unknown"}`;

    case "list_files":
      const type = action.params.type ? ` [${action.params.type}]` : "";
      return `list_files: ${action.params.path || "unknown"}${type}`;

    case "search_files":
      return `search_files: ${action.params.regex || "unknown"}`;

    case "attempt_completion":
      return `attempt_completion: ${action.params.command || ""}`;

    case "update_codebase_context":
      return `update_codebase_context: ${
        action.params.projectName || "project"
      }`;

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
