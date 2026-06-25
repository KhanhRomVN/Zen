import { normalizeTagVariants } from "./parsers/TagNormalizer";
import { parseToolAction, extractParamValue } from "./parsers/ToolParser";
import { extractThinkingBlocks } from "./parsers/ThinkingParser";

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
    | "execute_agent_action"
    | "delete_file"
    | "delete_folder"
    | "move_file"
    | "grep"
    | "git_status"
    | "commit_message"
    | "git_diff";
  params: Record<string, any>;
  rawXml: string;
  isPartial?: boolean;
}

export type ContentBlock =
  | { type: "code"; content: string; language?: string }
  | { type: "html"; content: string }
  | { type: "file"; content: string }
  | { type: "markdown"; content: string }
  | {
      type: "question";
      options: string[];
      title?: string;
      optional?: boolean;
      /** New structured questions for pagination */
      questions?: import("../types/message").Question[];
    }
  | {
      type: "mixed_content";
      segments: (
        | { type: "markdown"; content: string }
        | { type: "code"; content: string; language?: string }
      )[];
    }
  | { type: "tool"; action: ToolAction; actionIndex?: number }
  | { type: "thinking"; content: string };

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

  // Normalize all tag name variants to canonical forms
  remainingContent = normalizeTagVariants(remainingContent);

  // Pre-extract <thinking> blocks BEFORE any tool scanning so that tool tags
  // inside a thinking block are never mistaken for real tool calls.
  const {
    remainingContent: contentAfterThinking,
    thinkingBlocks,
    unclosedThinkingContent,
  } = extractThinkingBlocks(remainingContent);
  remainingContent = contentAfterThinking;

  // Scan for tools and text blocks
  // Note: "thinking" is intentionally excluded — thinking blocks are pre-extracted
  // above and stored in thinkingBlocks[]. Placeholders __THINKING_N__ in markdown
  // text will be restored after the main scan loop.
  const toolPatterns = [
    "read_file",
    "write_to_file",
    "replace_in_file",
    "run_command",
    "list_files",
    "search_files",
    "delete_file",
    "delete_folder",
    "move_file",
    "execute_agent_action",
    "grep",
    "git_status",
    "commit_message",
    "git_diff",
    "code",
    "file",
    "markdown",
    "question",
  ];

  // Fix missing opening bracket for the first tool call due to prefix/prefill stripping.
  // Use only horizontal whitespace (\t, space) — NOT \n — and no 'i' flag to avoid
  // accidentally eating the first character of normal text.
  const toolNamesPattern = toolPatterns.join("|");
  const missingBracketRegex = new RegExp(
    `^([ \t]*(?:•[ \t]*)?)(${toolNamesPattern})>`,
  );
  if (missingBracketRegex.test(remainingContent)) {
    remainingContent = remainingContent.replace(missingBracketRegex, "$1<$2>");
  }

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

    // 2. If no closed tag/block found at a closer position, check for unclosed start tags
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
      if (
        language === "markdown" ||
        (language === "text" && !codeContent.includes("\n"))
      ) {
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
          // Explicit <question> tag - supports both legacy and new schema
          const options: string[] = [];
          let title: string | undefined = undefined;
          const questions: import("../types/message").Question[] = [];

          // Extract title if present (legacy)
          const titleMatch =
            /<question_title>([\s\S]*?)<\/question_title>/i.exec(
              innerContent || "",
            );
          if (titleMatch) {
            title = titleMatch[1].trim();
          }

          // Try to parse new schema with <q> elements
          // Support both self-closing (<q ... />) and non-self-closing (<q ...>...</q>) tags
          // Use a more robust approach: find each <q> tag individually
          let hasNewSchema = false;
          const content = innerContent || "";

          // Count total <q> tags found (both self-closing and non-self-closing)
          const qTagCount = (content.match(/<q\s+id=/gi) || []).length;

          // Find all <q> tags using a more reliable approach
          // We'll process each tag by finding the opening <q and then finding the matching closing </q> or />
          let searchIndex = 0;
          let processedCount = 0;

          while (searchIndex < content.length) {
            // Find the next <q tag
            const qStart = content.indexOf("<q ", searchIndex);
            if (qStart === -1) break;

            // Find the end of the opening tag (> or />)
            let tagEnd = -1;
            let isSelfClosing = false;
            let depth = 0;
            let i = qStart + 2;

            while (i < content.length) {
              if (content[i] === "<" && content[i + 1] === "/") {
                // Closing tag - we're not inside the opening tag anymore
                break;
              }
              if (content[i] === ">" && content[i - 1] === "/") {
                // Self-closing: />
                isSelfClosing = true;
                tagEnd = i;
                break;
              }
              if (content[i] === ">") {
                tagEnd = i;
                break;
              }
              i++;
            }

            if (tagEnd === -1) {
              // No closing > found, move past this tag
              searchIndex = qStart + 2;
              continue;
            }

            // Extract the opening tag attributes
            const openTag = content.substring(qStart, tagEnd + 1);
            const idMatch = openTag.match(/id="([^"]+)"/);
            const typeMatch = openTag.match(/type="([^"]+)"/);
            const labelMatch = openTag.match(/label="([^"]*)"/);

            if (!idMatch || !typeMatch) {
              searchIndex = tagEnd + 1;
              continue;
            }

            hasNewSchema = true;
            const qId = idMatch[1].trim();
            const qType =
              typeMatch[1].trim() as import("../types/message").QuestionType;
            const qLabel = labelMatch ? labelMatch[1].trim() : "";

            let qInner = "";
            let closeTagEnd = tagEnd;

            if (!isSelfClosing) {
              // Find the matching closing </q>
              let closeIndex = content.indexOf("</q>", tagEnd + 1);
              if (closeIndex === -1) {
                // No closing tag found, treat as self-closing
                closeTagEnd = tagEnd;
              } else {
                // Extract inner content between opening and closing tags
                qInner = content.substring(tagEnd + 1, closeIndex);
                closeTagEnd = closeIndex + 4; // length of </q>
              }
            } else {
              closeTagEnd = tagEnd + 1;
            }

            const qOptions: string[] = [];
            // Only try to extract options if there is inner content
            if (qInner.trim()) {
              const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
              let optMatch;
              while ((optMatch = optionRegex.exec(qInner)) !== null) {
                if (optMatch[1].trim()) {
                  qOptions.push(optMatch[1].trim());
                }
              }
            }

            // For single/multi, ensure we have at least 2 options
            // For text/confirm, no options needed - skip validation
            if (qType === "single" || qType === "multi") {
              if (qOptions.length < 2) {
                console.warn(
                  `[Zen][Question] ⚠️ SKIPPING question "${qId}" - type ${qType} needs at least 2 options, got ${qOptions.length}`,
                );
                searchIndex = closeTagEnd;
                continue;
              }
            }

            const question = {
              id: qId,
              type: qType,
              label: qLabel || `Question ${questions.length + 1}`,
              options: qOptions.length > 0 ? qOptions : undefined,
            };

            questions.push(question);
            processedCount++;

            // Move search index past this tag
            searchIndex = closeTagEnd;
          }

          // If no new schema found, fall back to legacy parsing
          if (!hasNewSchema) {
            const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
            let optMatch;
            while ((optMatch = optionRegex.exec(innerContent || "")) !== null) {
              if (optMatch[1].trim()) {
                options.push(optMatch[1].trim());
              }
            }
          }

          const openTag = match[0].split(">")[0];
          const optional = /optional=["']true["']/i.test(openTag);

          // Build the question block
          const qBlock: ContentBlock = {
            type: "question",
            options: options.length > 0 ? options : [],
            title,
            optional,
            ...(questions.length > 0 ? { questions } : {}),
          };

          result.contentBlocks.push(qBlock);
          result.question = qBlock;

          // Legacy compatibility
          if (options.length > 0) {
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

          // Auto-recovery for read_file: if file_path is complete, synthesize the closing tag
          if (toolName === "read_file") {
            const filePathRegex = /<file_path>([\s\S]*?)<\/file_path>/i;
            const filePathMatch = (innerContent || "").match(filePathRegex);
            if (filePathMatch && filePathMatch[1].trim() !== "") {
              // Recovery condition met: build a fully-closed XML and parse normally
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</read_file>";
              const action = parseToolAction(
                "read_file",
                innerContent || "",
                recoveredRawXml,
              );
              // action.isPartial is intentionally NOT set
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

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

  // --- Restore thinking blocks from placeholders ---
  // Walk contentBlocks and expand any markdown block that contains __THINKING_N__ placeholders.
  const placeholderRegex = /__THINKING_(\d+)__/g;

  const expandedBlocks: ContentBlock[] = [];
  for (const block of result.contentBlocks) {
    if (block.type === "markdown" && placeholderRegex.test(block.content)) {
      // Reset lastIndex after the test() call
      placeholderRegex.lastIndex = 0;
      const parts = block.content.split(/__THINKING_(\d+)__/);
      // split with a capture group alternates: [text, idx, text, idx, ...text]
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          // text segment
          if (parts[i].trim()) {
            expandedBlocks.push({ type: "markdown", content: parts[i] });
          }
        } else {
          // thinking index
          const thinkingIdx = parseInt(parts[i], 10);
          expandedBlocks.push({
            type: "thinking",
            content: thinkingBlocks[thinkingIdx] ?? "",
          });
        }
      }
    } else if (block.type === "mixed_content") {
      // Also expand placeholders inside mixed_content segments
      const expandedSegments: any[] = [];
      for (const seg of block.segments) {
        if (seg.type === "markdown" && placeholderRegex.test(seg.content)) {
          placeholderRegex.lastIndex = 0;
          const parts = seg.content.split(/__THINKING_(\d+)__/);
          for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
              if (parts[i].trim()) {
                expandedSegments.push({ type: "markdown", content: parts[i] });
              }
            } else {
              const thinkingIdx = parseInt(parts[i], 10);
              // Push as a standalone thinking block outside this mixed_content
              expandedBlocks.push({
                type: "mixed_content",
                segments: expandedSegments.splice(0),
              } as any);
              expandedBlocks.push({
                type: "thinking",
                content: thinkingBlocks[thinkingIdx] ?? "",
              });
            }
          }
          if (expandedSegments.length > 0) {
            expandedBlocks.push({
              type: "mixed_content",
              segments: expandedSegments.splice(0),
            } as any);
          }
        } else {
          expandedSegments.push(seg);
        }
      }
      if (expandedSegments.length > 0) {
        expandedBlocks.push({ ...block, segments: expandedSegments } as any);
      }
    } else {
      expandedBlocks.push(block);
    }
  }

  // Replace contentBlocks with expanded version
  result.contentBlocks = expandedBlocks;

  // Append unclosed thinking block at the end (streaming case)
  if (unclosedThinkingContent !== null) {
    result.contentBlocks.push({
      type: "thinking",
      content: unclosedThinkingContent,
    });
  }

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

    case "move_file":
      return `move_file: ${action.params.file_path || "unknown"} → ${action.params.target_folder_path || "unknown"}`;

    case "git_status":
      const count = action.params.items?.length || 0;
      return `git_status: ${count} changes`;

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
