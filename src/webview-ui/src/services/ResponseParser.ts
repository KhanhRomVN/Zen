/**
 * Helper function để log parsing results
 */
const logParseResult = (
  section: string,
  success: boolean,
  data?: any,
  rawContent?: string
) => {
  const emoji = success ? "✅" : "❌";
  console.log(`[ResponseParser] ${emoji} ${section}`);
  if (success && data) {
    console.log(`[ResponseParser] 📦 Data:`, data);
  }
  if (!success && rawContent) {
    console.log(
      `[ResponseParser] 🔍 Raw content (first 200 chars):`,
      rawContent.substring(0, 200)
    );
  }
};

export interface ParsedResponse {
  thinking: string | null;
  followupQuestion: string | null;
  followupOptions: string[] | null;
  attemptCompletion: string | null;
  taskProgress: TaskProgressItem[] | null;
  actions: ToolAction[];
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
    | "list_code_definition_names"
    | "ask_followup_question"
    | "attempt_completion";
  params: Record<string, any>;
  rawXml: string;
  taskProgress?: TaskProgressItem[] | null;
}

/**
 * Parse XML-like content to extract parameter value
 */
const extractParamValue = (
  content: string,
  paramName: string
): string | null => {
  // Try standard XML tag first
  const standardRegex = new RegExp(
    `<${paramName}>([\\s\\S]*?)<\\/${paramName}>`,
    "i"
  );
  const standardMatch = content.match(standardRegex);
  if (standardMatch) {
    let value = standardMatch[1].trim();
    // Remove ```text wrappers if present
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    console.log(
      `[ResponseParser] ✅ Extracted param "${paramName}": ${value.substring(
        0,
        100
      )}${value.length > 100 ? "..." : ""}`
    );
    return value;
  }

  // Try self-closing tag with content
  const selfClosingRegex = new RegExp(
    `<${paramName}\\s*>([\\s\\S]*?)(?=<[\\w_]+>|$)`,
    "i"
  );
  const selfClosingMatch = content.match(selfClosingRegex);
  if (selfClosingMatch) {
    let value = selfClosingMatch[1].trim();
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    console.log(
      `[ResponseParser] ✅ Extracted param "${paramName}" (self-closing): ${value.substring(
        0,
        100
      )}${value.length > 100 ? "..." : ""}`
    );
    return value;
  }

  console.log(`[ResponseParser] ❌ Failed to extract param "${paramName}"`);
  return null;
};

/**
 * Parse task_progress content to extract checklist items
 */
const parseTaskProgress = (content: string): TaskProgressItem[] | null => {
  if (!content) {
    console.log(`[ResponseParser] ⚠️ parseTaskProgress: Empty content`);
    return null;
  }

  // Remove ```text wrappers
  const cleanContent = content.replace(/^```text\s*\n?|\n?```\s*$/g, "").trim();
  console.log(
    `[ResponseParser] 🔄 Parsing task progress, lines: ${
      cleanContent.split("\n").length
    }`
  );

  const items: TaskProgressItem[] = [];
  const lines = cleanContent.split("\n");

  for (const line of lines) {
    // Match patterns:
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
      console.log(
        `[ResponseParser] ✅ Task item: ${item.completed ? "[x]" : "[ ]"} ${
          item.text
        }`
      );
    } else if (line.trim()) {
      console.log(
        `[ResponseParser] ❌ Failed to parse line: "${line.substring(0, 50)}"`
      );
    }
  }

  if (items.length > 0) {
    console.log(`[ResponseParser] ✅ Total task items parsed: ${items.length}`);
  } else {
    console.log(`[ResponseParser] ❌ No task items found`);
  }

  return items.length > 0 ? items : null;
};

/**
 * Extract all tool calls from content
 */
const extractToolCalls = (content: string): ToolAction[] => {
  console.log(
    `[ResponseParser] 🔧 Starting tool extraction, content length: ${content.length}`
  );
  const actions: ToolAction[] = [];

  const toolPatterns = [
    "read_file",
    "write_to_file",
    "replace_in_file",
    "execute_command",
    "list_files",
    "search_files",
    "list_code_definition_names",
    "ask_followup_question",
    "attempt_completion",
  ];

  for (const toolName of toolPatterns) {
    // Match tool tags with greedy approach to handle nested content
    const regex = new RegExp(
      `<${toolName}>((?:[\\s\\S](?!<${toolName}>))*?)<\\/${toolName}>`,
      "g"
    );
    let match;
    let matchCount = 0;

    while ((match = regex.exec(content)) !== null) {
      matchCount++;
      console.log(
        `[ResponseParser] ✅ Found tool: ${toolName} (${matchCount})`
      );
      const rawXml = match[0];
      const innerContent = match[1];

      const params: Record<string, any> = {};

      // Extract specific parameters based on tool type
      switch (toolName) {
        case "read_file":
          params.path = extractParamValue(innerContent, "path");
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
          const requiresApproval = extractParamValue(
            innerContent,
            "requires_approval"
          );
          params.requires_approval = requiresApproval === "true";
          break;

        case "list_files":
          params.path = extractParamValue(innerContent, "path");
          const recursive = extractParamValue(innerContent, "recursive");
          params.recursive = recursive === "true";
          break;

        case "search_files":
          params.path = extractParamValue(innerContent, "path");
          params.regex = extractParamValue(innerContent, "regex");
          params.file_pattern = extractParamValue(innerContent, "file_pattern");
          break;

        case "list_code_definition_names":
          params.path = extractParamValue(innerContent, "path");
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
      }

      // Extract task_progress if present in this tool call
      const taskProgressContent = extractParamValue(
        innerContent,
        "task_progress"
      );
      const taskProgress = taskProgressContent
        ? parseTaskProgress(taskProgressContent)
        : null;

      const action = {
        type: toolName as any,
        params,
        rawXml,
        taskProgress,
      };
      actions.push(action);
      console.log(
        `[ResponseParser] 📦 Action added:`,
        JSON.stringify(
          {
            type: action.type,
            params: action.params,
            hasTaskProgress: !!taskProgress,
          },
          null,
          2
        )
      );
    }

    if (matchCount === 0) {
      console.log(`[ResponseParser] ⚠️ No matches found for tool: ${toolName}`);
    }
  }

  console.log(`[ResponseParser] ✅ Total tools extracted: ${actions.length}`);
  return actions;
};

/**
 * Parse AI response để extract thinking, task_progress, và tool actions
 */
export const parseAIResponse = (content: string): ParsedResponse => {
  console.log(`[ResponseParser] 🚀 Starting AI response parsing`);
  console.log(`[ResponseParser] 📄 Content length: ${content.length} chars`);
  console.log(
    `[ResponseParser] 📄 First 200 chars: ${content.substring(0, 200)}...`
  );

  const result: ParsedResponse = {
    thinking: null,
    followupQuestion: null,
    followupOptions: null,
    attemptCompletion: null,
    taskProgress: null,
    actions: [],
    displayText: "",
  };

  // 1. Extract <thinking> content
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  if (thinkingMatch) {
    result.thinking = thinkingMatch[1].trim();
    logParseResult("Thinking", true, {
      length: result.thinking.length,
      preview: result.thinking.substring(0, 100),
    });
  } else {
    logParseResult("Thinking", false, null, content);
  }

  // 1.5. Extract <ask_followup_question> content
  const followupMatch = content.match(
    /<ask_followup_question>([\s\S]*?)<\/ask_followup_question>/
  );
  if (followupMatch) {
    const questionMatch = followupMatch[1].match(
      /<question>([\s\S]*?)<\/question>/
    );
    if (questionMatch) {
      result.followupQuestion = questionMatch[1].trim();
      logParseResult("Followup Question", true, {
        length: result.followupQuestion.length,
        preview: result.followupQuestion.substring(0, 100),
      });
    }

    // Extract options if present
    const optionsMatch = followupMatch[1].match(
      /<options>([\s\S]*?)<\/options>/
    );
    if (optionsMatch) {
      try {
        result.followupOptions = JSON.parse(optionsMatch[1].trim());
        logParseResult("Followup Options", true, {
          count: result.followupOptions?.length || 0,
        });
      } catch (error) {
        console.error(
          `[ResponseParser] ❌ Failed to parse options JSON:`,
          error
        );
        result.followupOptions = null;
      }
    }
  } else {
    logParseResult("Thinking", false, null, content);
  }

  // 1.6. Extract <attempt_completion> result
  const attemptCompletionMatch = content.match(
    /<attempt_completion>([\s\S]*?)<\/attempt_completion>/
  );
  if (attemptCompletionMatch) {
    const resultMatch = attemptCompletionMatch[1].match(
      /<result>([\s\S]*?)<\/result>/
    );
    if (resultMatch) {
      result.attemptCompletion = resultMatch[1].trim();
      logParseResult("Attempt Completion", true, {
        length: result.attemptCompletion.length,
        preview: result.attemptCompletion.substring(0, 100),
      });
    }
  } else {
    logParseResult("Attempt Completion", false);
  }

  // 2. Extract global <task_progress> (outside of tool calls)
  const globalTaskProgressMatch = content.match(
    /<task_progress>([\s\S]*?)<\/task_progress>/
  );
  if (globalTaskProgressMatch) {
    result.taskProgress = parseTaskProgress(globalTaskProgressMatch[1]);
    logParseResult("Global Task Progress", !!result.taskProgress, {
      itemCount: result.taskProgress?.length || 0,
    });
  } else {
    logParseResult("Global Task Progress", false);
  }

  // 3. Extract all tool actions
  result.actions = extractToolCalls(content);
  logParseResult("Tool Actions", true, {
    count: result.actions.length,
    types: result.actions.map((a) => a.type),
  });

  // 4. Generate display text
  let displayText = content;

  // Remove <thinking> tags
  displayText = displayText.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, "");

  // Remove <ask_followup_question> tags
  displayText = displayText.replace(
    /<ask_followup_question>[\s\S]*?<\/ask_followup_question>\s*/g,
    ""
  );

  // Remove <attempt_completion> tags
  displayText = displayText.replace(
    /<attempt_completion>[\s\S]*?<\/attempt_completion>\s*/g,
    ""
  );

  // Remove global <task_progress> tags
  displayText = displayText.replace(
    /<task_progress>[\s\S]*?<\/task_progress>\s*/g,
    ""
  );

  // Remove all tool tags
  const toolPatterns = [
    "read_file",
    "write_to_file",
    "replace_in_file",
    "execute_command",
    "list_files",
    "search_files",
    "list_code_definition_names",
    "ask_followup_question",
    "attempt_completion",
  ];

  for (const toolName of toolPatterns) {
    const regex = new RegExp(
      `<${toolName}>(?:[\\s\\S](?!<${toolName}>))*?<\\/${toolName}>\\s*`,
      "g"
    );
    displayText = displayText.replace(regex, "");
  }

  displayText = displayText.trim();

  // Priority: followupQuestion > displayText (thinking shown separately)
  if (result.followupQuestion) {
    result.displayText = result.followupQuestion;
    console.log(
      `[ResponseParser] 📝 Using followup question as displayText (${result.followupQuestion.length} chars)`
    );
  } else if (displayText) {
    result.displayText = displayText;
    console.log(
      `[ResponseParser] 📝 Using cleaned text as displayText (${displayText.length} chars)`
    );
  } else {
    console.log(`[ResponseParser] ⚠️ No displayText generated`);
  }

  console.log(`[ResponseParser] ✅ Parse complete:`, {
    hasThinking: !!result.thinking,
    hasTaskProgress: !!result.taskProgress,
    actionCount: result.actions.length,
    displayTextLength: result.displayText.length,
  });

  return result;
};

/**
 * Format tool action for display
 */
export const formatActionForDisplay = (action: ToolAction): string => {
  switch (action.type) {
    case "read_file":
      return `📖 Reading file: ${action.params.path || "unknown"}`;

    case "write_to_file":
      return `✍️ Writing to file: ${action.params.path || "unknown"}`;

    case "replace_in_file":
      return `🔄 Replacing in file: ${action.params.path || "unknown"}`;

    case "execute_command":
      const approval = action.params.requires_approval
        ? " (requires approval)"
        : "";
      return `⚡ Executing command${approval}: ${
        action.params.command || "unknown"
      }`;

    case "list_files":
      const recursive = action.params.recursive ? " (recursive)" : "";
      return `📁 Listing files${recursive}: ${action.params.path || "unknown"}`;

    case "search_files":
      const pattern = action.params.file_pattern
        ? ` (${action.params.file_pattern})`
        : "";
      return `🔍 Searching${pattern}: ${action.params.regex || "unknown"}`;

    case "list_code_definition_names":
      return `📚 Listing code definitions in: ${
        action.params.path || "unknown"
      }`;

    case "ask_followup_question":
      const preview = action.params.question?.substring(0, 80) || "unknown";
      return `❓ Question: ${preview}${
        action.params.question && action.params.question.length > 80
          ? "..."
          : ""
      }`;

    case "attempt_completion":
      const resultPreview = action.params.result?.substring(0, 80) || "done";
      return `✅ Task completion: ${resultPreview}${
        action.params.result && action.params.result.length > 80 ? "..." : ""
      }`;

    default:
      return `🔧 ${action.type}`;
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
