/**
 * ResponseParser - Xử lý và parse JSON response từ AI
 */

export interface ParsedAction {
  type: "text" | "file_read" | "file_edit" | "file_add" | "command_exec";
  content: string;
  metadata?: {
    filePath?: string;
    operation?: string;
    status?: "success" | "error";
    [key: string]: any;
  };
}

export interface ParsedResponse {
  actions: ParsedAction[];
  rawResponse: string;
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Parse AI response JSON và extract actions
 */
export const parseAIResponse = (response: string): ParsedResponse => {
  try {
    // Try parse as JSON first
    const parsed = JSON.parse(response);

    // Check if it's OpenAI format
    if (parsed.choices?.[0]?.delta?.content) {
      return parseOpenAIFormat(parsed.choices[0].delta.content);
    }

    // Check if it's our custom format with tool calls
    if (parsed.actions || parsed.tool_calls) {
      return parseToolCallsFormat(parsed);
    }

    // Fallback: treat as plain text
    return {
      actions: [
        {
          type: "text",
          content: response,
        },
      ],
      rawResponse: response,
      hasError: false,
    };
  } catch (error) {
    // Not valid JSON, treat as plain text
    return {
      actions: [
        {
          type: "text",
          content: response,
        },
      ],
      rawResponse: response,
      hasError: false,
    };
  }
};

/**
 * Parse OpenAI streaming format
 */
const parseOpenAIFormat = (content: string): ParsedResponse => {
  // Check if content contains tool calls markers
  const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs;
  const matches = Array.from(content.matchAll(toolCallRegex));

  if (matches.length > 0) {
    const actions: ParsedAction[] = [];

    // Extract text before first tool call
    const beforeFirstCall = content.substring(0, matches[0].index);
    if (beforeFirstCall.trim()) {
      actions.push({
        type: "text",
        content: beforeFirstCall.trim(),
      });
    }

    // Parse each tool call
    matches.forEach((match, index) => {
      try {
        const toolCallJson = JSON.parse(match[1]);
        actions.push(parseToolCall(toolCallJson));

        // Extract text between this and next tool call
        const startIndex = match.index! + match[0].length;
        const endIndex =
          index < matches.length - 1
            ? matches[index + 1].index!
            : content.length;
        const betweenText = content.substring(startIndex, endIndex).trim();
        if (betweenText) {
          actions.push({
            type: "text",
            content: betweenText,
          });
        }
      } catch (error) {
        console.error("[ResponseParser] Failed to parse tool call:", error);
      }
    });

    return {
      actions,
      rawResponse: content,
      hasError: false,
    };
  }

  // No tool calls, just text
  return {
    actions: [
      {
        type: "text",
        content: content,
      },
    ],
    rawResponse: content,
    hasError: false,
  };
};

/**
 * Parse tool calls format
 */
const parseToolCallsFormat = (parsed: any): ParsedResponse => {
  const actions: ParsedAction[] = [];

  // Handle custom actions array
  if (Array.isArray(parsed.actions)) {
    parsed.actions.forEach((action: any) => {
      actions.push(parseToolCall(action));
    });
  }

  // Handle tool_calls array
  if (Array.isArray(parsed.tool_calls)) {
    parsed.tool_calls.forEach((toolCall: any) => {
      actions.push(parseToolCall(toolCall));
    });
  }

  return {
    actions,
    rawResponse: JSON.stringify(parsed),
    hasError: false,
  };
};

/**
 * Parse individual tool call
 */
const parseToolCall = (toolCall: any): ParsedAction => {
  const type = toolCall.type || toolCall.function?.name || "text";

  switch (type) {
    case "read_file":
    case "file_read":
      return {
        type: "file_read",
        content: `Reading file: ${
          toolCall.parameters?.path || toolCall.arguments?.path
        }`,
        metadata: {
          filePath: toolCall.parameters?.path || toolCall.arguments?.path,
          operation: "read",
        },
      };

    case "write_file":
    case "file_edit":
      return {
        type: "file_edit",
        content: `Editing file: ${
          toolCall.parameters?.path || toolCall.arguments?.path
        }`,
        metadata: {
          filePath: toolCall.parameters?.path || toolCall.arguments?.path,
          operation: "write",
          content: toolCall.parameters?.content || toolCall.arguments?.content,
        },
      };

    case "create_file":
    case "file_add":
      return {
        type: "file_add",
        content: `Creating file: ${
          toolCall.parameters?.path || toolCall.arguments?.path
        }`,
        metadata: {
          filePath: toolCall.parameters?.path || toolCall.arguments?.path,
          operation: "create",
          content: toolCall.parameters?.content || toolCall.arguments?.content,
        },
      };

    case "execute_command":
    case "command_exec":
      return {
        type: "command_exec",
        content: `Executing: ${
          toolCall.parameters?.command || toolCall.arguments?.command
        }`,
        metadata: {
          operation: "execute",
          command: toolCall.parameters?.command || toolCall.arguments?.command,
        },
      };

    default:
      return {
        type: "text",
        content: JSON.stringify(toolCall, null, 2),
      };
  }
};

/**
 * Format action for display
 */
export const formatActionForDisplay = (action: ParsedAction): string => {
  switch (action.type) {
    case "file_read":
      return `📖 **Reading File**\n\`\`\`\n${action.metadata?.filePath}\n\`\`\``;

    case "file_edit":
      return `✏️ **Editing File**\n\`\`\`\n${
        action.metadata?.filePath
      }\n\`\`\`\n${
        action.metadata?.content
          ? "```\n" + action.metadata.content + "\n```"
          : ""
      }`;

    case "file_add":
      return `➕ **Creating File**\n\`\`\`\n${
        action.metadata?.filePath
      }\n\`\`\`\n${
        action.metadata?.content
          ? "```\n" + action.metadata.content + "\n```"
          : ""
      }`;

    case "command_exec":
      return `⚡ **Executing Command**\n\`\`\`bash\n${action.metadata?.command}\n\`\`\``;

    case "text":
    default:
      return action.content;
  }
};
