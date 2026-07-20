import { normalizeTagVariants } from "../utils/TagNormalizer";
import { parseToolAction } from "../utils/ToolParser";
import {
  getAllToolTypes,
  type ExecutableToolType,
} from "../constants/tool-registry";
import { validateToolParams, type ToolParamValidation } from "../utils/ToolParamValidator";
// Tag parsers
import { parseReadFile } from "./parsers/ReadFileParser";
import { parseWriteToFile } from "./parsers/WriteToFileParser";
import { parseReplaceInFile } from "./parsers/ReplaceInFileParser";
import { parseListFiles } from "./parsers/ListFilesParser";
import { parseFindFiles } from "./parsers/FindFilesParser";
import { parseGrep } from "./parsers/GrepParser";
import { parseDeleteFile } from "./parsers/DeleteFileParser";
import { parseDeleteFolder } from "./parsers/DeleteFolderParser";
import { parseMoveFile } from "./parsers/MoveFileParser";
import { parseRevertFile } from "./parsers/RevertFileParser";
import { parseViewReplaceHistory } from "./parsers/ViewReplaceHistoryParser";
import { parseRunCommand } from "./parsers/RunCommandParser";
import { parseGitStatus } from "./parsers/GitStatusParser";
import { parseGitDiff } from "./parsers/GitDiffParser";
import { parseCommitMessage } from "./parsers/CommitMessageParser";
import { parseMarkdown } from "./parsers/MarkdownParser";
import { parseCode } from "./parsers/CodeParser";
import { extractThinkingBlocks } from "./parsers/ThinkingParser";
import { parseContextCompression } from "./parsers/ContextCompressionParser";
import { findClosingTagPosition } from "../utils/TagClosingFinder";

export interface ParsedResponse {
  followupQuestion: string | null;
  followupOptions: string[] | null;
  taskName: string | null;
  actions: ToolAction[];
  contentBlocks: ContentBlock[];
  displayText: string;
  question: ContentBlock | null;
  /** True if response contains ONLY thinking blocks, no other content or tools */
  onlyThinkingDetected?: boolean;
}

export interface ToolAction {
  type: ExecutableToolType | "context_compression" | "thinking" | "question";
  params: Record<string, any>;
  rawXml: string;
  /** True if this action has a parsing error (e.g., unclosed tag) */
  isError?: boolean;
  /** Error message if isError is true */
  errorMessage?: string;
  /** Error code if isError is true */
  errorCode?: string;
}

export type ContentBlock =
  | { type: "code"; content: string; language?: string }
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
  | { type: "thinking"; content: string }
  | {
      type: "error";
      content: string;
      errorCode?: string;
      toolName?: string;
      toolParams?: Record<string, any>;
    };

/**
 * Parse AI response to extract tool actions
 * Supports interleaved text and tool calls
 */
// Enable debug logs via localStorage
const DEBUG_PARSER =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("zen_debug_parser") === "true";

export const parseAIResponse = (content: string): ParsedResponse => {
  const _parseStartTime = performance.now();

  // Track parsing sequence for debugging
  const parsingSequence: { index: number; tag: string; subTags?: string[] }[] =
    [];
  let sequenceCounter = 0;

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
  const { remainingContent: contentAfterThinking, thinkingBlocks } =
    extractThinkingBlocks(remainingContent);

  remainingContent = contentAfterThinking;

  // 🔍 ALWAYS log if content is stripped completely
  // BUT skip if this is likely a streaming intermediate state
  const isLikelyStreaming =
    remainingContent.trim().length === 0 &&
    content.trim().length > 0 &&
    content.trim().length < 2000 && // Small content, likely incomplete
    !content.includes("</thinking>"); // No closing tag yet

  if (
    remainingContent.trim().length === 0 &&
    content.trim().length > 100 &&
    !isLikelyStreaming
  ) {
    console.warn(
      "[Zen][Parser] ⚠️ All content consumed by thinking extraction!",
      {
        originalLength: content.length,
        thinkingBlocks: thinkingBlocks.length,
      },
    );
  }

  // Scan for tools and text blocks
  // Note: "thinking" is intentionally excluded — thinking blocks are pre-extracted
  // above and stored in thinkingBlocks[]. Placeholders __THINKING_N__ in markdown
  // text will be restored after the main scan loop.

  // Auto-generated from Tool Registry - includes all tools plus special tags
  const toolPatterns = [
    ...getAllToolTypes().filter((t) => t !== "thinking"), // Exclude thinking (pre-extracted)
    "file", // Special display tag not in registry
    "markdown", // Special display tag
    "code", // Special display tag
    "question", // Special display tag
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
  /**
   * Validate that all param tags inside a tool have proper closing tags
   * Returns the name of the first missing closing tag, or null if all are closed
   * 
   * IMPORTANT: This validates XML param tags (like <file_path>, <content>), NOT HTML tags inside content.
   * For display tags like <markdown>, <code>, <file>, we skip validation since their content may contain HTML.
   * <question> is NOT skipped because it contains structured XML (<q>, <option>) that needs validation.
   */
  const validateParamTags = (
    innerContent: string,
    toolName: string,
  ): string | null => {
    // Skip validation for display tags - they can contain arbitrary HTML
    const DISPLAY_TAGS = ['markdown', 'code', 'file'];
    if (DISPLAY_TAGS.includes(toolName)) {
      return null; // Don't validate HTML tags inside display content
    }

    // Extract all opening param tags (excluding self-closing tags like <q ... />)
    const openTagRegex = /<([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s+[^>]*)?>(?!\/)/g;
    const selfClosingRegex = /<([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s+[^>]*)?\/>/g;
    const closeTagRegex = /<\/([a-zA-Z_][a-zA-Z0-9_]*)>/g;

    const openTags: string[] = [];
    const selfClosingTags: Set<string> = new Set();
    const closeTags: string[] = [];

    let match;
    
    // Find self-closing tags first
    while ((match = selfClosingRegex.exec(innerContent)) !== null) {
      selfClosingTags.add(match[1]);
    }
    
    // Find opening tags (non-self-closing)
    while ((match = openTagRegex.exec(innerContent)) !== null) {
      const tagName = match[1];
      // Only count as opening tag if it's not immediately followed by />
      const fullMatch = match[0];
      if (!fullMatch.endsWith('/>')) {
        openTags.push(tagName);
      }
    }

    // Find closing tags
    while ((match = closeTagRegex.exec(innerContent)) !== null) {
      closeTags.push(match[1]);
    }

    // Check each opening tag has a corresponding closing tag
    // Ignore tags that are self-closing
    for (const tag of openTags) {
      const openCount = openTags.filter((t) => t === tag).length;
      const closeCount = closeTags.filter((t) => t === tag).length;

      if (openCount > closeCount) {
        return tag; // This tag is missing closing tag(s)
      }
    }

    return null;
  };

  const findNextTag = (str: string) => {
    let minIndex = -1;
    let bestMatch: any = null;
    let bestTool = "";
    let isClosed = false;

    // 1. Try to find complete (closed) tags first using backtick-aware search
    for (const toolName of toolPatterns) {
      // Find opening tag
      const openTag = `<${toolName}`;
      const openRegex = new RegExp(`<${toolName}(?:\\s+[^>]*)?>`, "i");
      const openMatch = openRegex.exec(str);

      if (!openMatch) continue;

      const openIndex = openMatch.index;
      const openTagFull = openMatch[0];
      const startContentPos = openIndex + openTagFull.length;

      // Check if it's self-closing
      if (openTagFull.trim().endsWith("/>")) {
        // Self-closing tag
        if (minIndex === -1 || openIndex < minIndex) {
          minIndex = openIndex;
          bestMatch = [openTagFull, ""]; // No inner content
          bestTool = toolName;
          isClosed = true;
        }
        continue;
      }

      // Find closing tag using backtick-aware search
      const closingTagPattern = `</${toolName}>`;
      const closingPos = findClosingTagPosition(
        str,
        startContentPos,
        closingTagPattern,
      );

      if (closingPos !== -1) {
        // Validate that all param tags inside are properly closed
        const innerContent = str.substring(startContentPos, closingPos);
        const missingParamTag = validateParamTags(innerContent, toolName);

        if (missingParamTag) {
          // Found unclosed param tag - don't register as valid closed tag
          if (DEBUG_PARSER) {
            console.warn("[Zen][Parser] ⚠️ UNCLOSED PARAM TAG:", {
              toolName,
              missingParam: missingParamTag,
              contentPreview: innerContent.substring(0, 200),
            });
          }
          // Skip this tool - will be caught as unclosed in main loop
          continue;
        }

        if (minIndex === -1 || openIndex < minIndex) {
          const innerContent = str.substring(startContentPos, closingPos);
          const fullMatch = str.substring(
            openIndex,
            closingPos + closingTagPattern.length,
          );
          minIndex = openIndex;
          bestMatch = [fullMatch, innerContent];
          bestMatch.index = openIndex;
          bestTool = toolName;
          isClosed = true;
        }
      }
    }

    // 2. If no closed tag found, check for unclosed start tags
    if (minIndex === -1) {
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
      // 1. Everything before the tag is markdown
      const prefix = scanStr.substring(0, index);
      if (prefix.trim()) {
        pushTextOrCodeBlocks("markdown", prefix);
      }

      // 2. Handle the tag
      const rawXml = match[0];

      if (isClosed) {
        const innerContent = match[1];

        // Extract sub-tags for debugging
        const extractSubTags = (content: string): string[] => {
          const subTagRegex =
            /<([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s+[^>]*)?>[\s\S]*?<\/\1>/g;
          const selfClosingRegex =
            /<([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s+[^>]*)?\/>/g;
          const subTags = new Set<string>();

          let match;
          while ((match = subTagRegex.exec(content)) !== null) {
            subTags.add(match[1]);
          }
          while ((match = selfClosingRegex.exec(content)) !== null) {
            subTags.add(match[1]);
          }

          return Array.from(subTags);
        };

        const subTags = extractSubTags(innerContent || "");
        parsingSequence.push({
          index: ++sequenceCounter,
          tag: toolName,
          ...(subTags.length > 0 ? { subTags } : {}),
        });

        if (DEBUG_PARSER) {
          const subTagInfo =
            subTags.length > 0 ? ` (${subTags.join(", ")})` : "";
        }

        if (toolName === "code") {
          // Explicit <code> tag - use CodeParser
          const codeData = parseCode(innerContent || "");
          if (codeData.content) {
            result.contentBlocks.push({
              type: "code",
              content: codeData.content,
              language: codeData.language || "text",
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
          // Explicit <markdown> tag - use MarkdownParser
          const content = parseMarkdown(innerContent || "");
          if (content) {
            pushTextOrCodeBlocks("markdown", content);
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
            // Support both double quotes and single quotes for label attribute
            // Handle HTML entities and decode them
            let qLabel = "";
            const doubleQuoteMatch = openTag.match(/label="([^"]*)"/);
            const singleQuoteMatch = openTag.match(/label='([^']*)'/);
            if (doubleQuoteMatch) {
              qLabel = doubleQuoteMatch[1].trim();
            } else if (singleQuoteMatch) {
              qLabel = singleQuoteMatch[1].trim();
            }

            // Decode HTML entities if present
            if (qLabel) {
              const textarea = document.createElement("textarea");
              textarea.innerHTML = qLabel;
              qLabel = textarea.value;
            }

            if (!idMatch || !typeMatch) {
              searchIndex = tagEnd + 1;
              continue;
            }

            hasNewSchema = true;
            const qId = idMatch[1].trim();
            const qType =
              typeMatch[1].trim() as import("../types/message").QuestionType;
            // qLabel is now set above via double/single quote detection

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

          // VALIDATION: Only push question block if it has valid content
          // Skip empty questions to avoid showing empty outline boxes during streaming
          const hasValidContent = options.length > 0 || questions.length > 0;

          if (hasValidContent) {
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
          }
        } else {
          // It's a tool - delegate to individual tag parsers
          const actionIndex = result.actions.length;
          let action: ToolAction;

          switch (toolName) {
            case "read_file": {
              const params = parseReadFile(innerContent || "");
              const validation = validateToolParams("read_file", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "read_file" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "read_file" as const, params, rawXml };
              }
              break;
            }
            case "write_to_file": {
              const params = parseWriteToFile(innerContent || "");
              const validation = validateToolParams("write_to_file", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "write_to_file" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "write_to_file" as const, params, rawXml };
              }
              break;
            }
            case "replace_in_file": {
              const params = parseReplaceInFile(innerContent || "");
              const validation = validateToolParams("replace_in_file", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "replace_in_file" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "replace_in_file" as const, params, rawXml };
              }
              break;
            }
            case "list_files": {
              const params = parseListFiles(innerContent || "");
              const validation = validateToolParams("list_files", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "list_files" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "list_files" as const, params, rawXml };
              }
              break;
            }
            case "find_files": {
              const params = parseFindFiles(innerContent || "");
              const validation = validateToolParams("find_files", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "find_files" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "find_files" as const, params, rawXml };
              }
              break;
            }
            case "grep": {
              const params = parseGrep(innerContent || "");
              const validation = validateToolParams("grep", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "grep" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "grep" as const, params, rawXml };
              }
              break;
            }
            case "delete_file": {
              const params = parseDeleteFile(innerContent || "");
              const validation = validateToolParams("delete_file", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "delete_file" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "delete_file" as const, params, rawXml };
              }
              break;
            }
            case "delete_folder": {
              const params = parseDeleteFolder(innerContent || "");
              const validation = validateToolParams("delete_folder", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "delete_folder" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "delete_folder" as const, params, rawXml };
              }
              break;
            }
            case "move_file": {
              const params = parseMoveFile(innerContent || "");
              const validation = validateToolParams("move_file", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "move_file" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "move_file" as const, params, rawXml };
              }
              break;
            }
            case "revert_file": {
              const params = parseRevertFile(innerContent || "");
              action = { type: "revert_file" as const, params, rawXml };
              break;
            }
            case "view_replace_history": {
              const params = parseViewReplaceHistory(innerContent || "");
              action = {
                type: "view_replace_history" as const,
                params,
                rawXml,
              };
              break;
            }
            case "run_command": {
              const params = parseRunCommand(innerContent || "");
              const validation = validateToolParams("run_command", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "run_command" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "run_command" as const, params, rawXml };
              }
              break;
            }
            case "git_status": {
              const params = parseGitStatus(innerContent || "");
              action = { type: "git_status" as const, params, rawXml };
              break;
            }
            case "git_diff": {
              const params = parseGitDiff(innerContent || "");
              const validation = validateToolParams("git_diff", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "git_diff" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "git_diff" as const, params, rawXml };
              }
              break;
            }
            case "commit_message": {
              const params = parseCommitMessage(innerContent || "");
              const validation = validateToolParams("commit_message", params, innerContent || "");
              if (!validation.isValid) {
                action = {
                  type: "commit_message" as const,
                  params,
                  rawXml,
                  isError: true,
                  errorMessage: validation.errorMessage,
                  errorCode: validation.errorCode,
                };
              } else {
                action = { type: "commit_message" as const, params, rawXml };
              }
              break;
            }
            case "context_compression": {
              const params = parseContextCompression(rawXml);
              if (params) {
                action = {
                  type: "context_compression" as const,
                  params,
                  rawXml,
                };
              } else {
                // Fallback if parsing fails
                action = {
                  type: "context_compression" as const,
                  params: { summary: "" },
                  rawXml,
                };
              }
              break;
            }
            default:
              // Fallback to ToolParser for any unhandled tools
              action = parseToolAction(toolName, innerContent || "", rawXml);
          }

          result.contentBlocks.push({ type: "tool", action, actionIndex });
          result.actions.push(action); // Populate legacy actions array

          if (DEBUG_PARSER) {
          }
        }

        // 3. Advance scanStr
        scanStr = scanStr.substring(index + rawXml.length);
      } else {
        // Unclosed tag detected - create malformed tool action
        // Try to extract params from the partial content we have
        const partialContent = scanStr.substring(index);
        const openTagEnd = partialContent.indexOf(">");
        let toolParams: Record<string, any> = {};
        let missingParamTag: string | null = null;
        let invalidParamInfo: { found: string; expected: string[] } | null = null;

        if (openTagEnd !== -1) {
          // We have the opening tag, try to extract any content before it breaks
          const contentStart = openTagEnd + 1;
          const remainingAfterTag = partialContent.substring(contentStart);

          // Check if it's missing param closing tags
          missingParamTag = validateParamTags(remainingAfterTag, toolName);

          // Try to parse whatever params we can from the partial content
          // This is best-effort - some params might be incomplete
          try {
            // Extract common param tags like <file_path>, <search_text>, etc.
            const paramRegex = /<([a-zA-Z_][a-zA-Z0-9_]*?)>([\s\S]*?)<\/\1>/g;
            let paramMatch;
            while ((paramMatch = paramRegex.exec(remainingAfterTag)) !== null) {
              toolParams[paramMatch[1]] = paramMatch[2].trim();
            }
          } catch (e) {
            // Ignore parsing errors for incomplete content
          }

          // Check if extracted params have invalid names (wrong variants)
          const validation = validateToolParams(toolName, toolParams, remainingAfterTag);
          if (!validation.isValid && validation.errorCode === "INVALID_PARAM_NAME" && validation.invalidParams) {
            invalidParamInfo = {
              found: validation.invalidParams[0].found,
              expected: validation.invalidParams[0].expected,
            };
          }
        }

        // Build error message based on what we found
        let errorMessage: string;
        let errorCode: string;

        if (invalidParamInfo) {
          // Invalid param name detected
          errorMessage = `Malformed tool output: <${toolName}> contains invalid parameter name <${invalidParamInfo.found}>. Expected <${invalidParamInfo.expected[0]}>. Valid variants: ${invalidParamInfo.expected.join(", ")}. Please use the correct parameter name.`;
          errorCode = "INVALID_PARAM_NAME";
        } else if (missingParamTag) {
          // Missing param closing tag
          errorMessage = `Malformed tool output: <${toolName}> tag is missing closing tag for parameter <${missingParamTag}>. Please ensure all XML tags are properly closed.`;
          errorCode = "UNCLOSED_PARAM_TAG";
        } else {
          // Missing tool closing tag
          errorMessage = `Malformed tool output: <${toolName}> tag is missing closing tag. Please ensure all XML tags are properly closed.`;
          errorCode = "UNCLOSED_TAG";
        }

        console.error("[Zen][Parser] ⚠️ MALFORMED TOOL DETECTED:", {
          toolName,
          errorCode,
          tagPosition: index,
          remainingContentLength: scanStr.length,
          contentAroundTag: scanStr.substring(
            Math.max(0, index - 50),
            index + 150,
          ),
          searchedFor: `</${toolName}>`,
          foundClosingTag: false,
          missingParamTag: missingParamTag || "none",
          invalidParamName: invalidParamInfo ? invalidParamInfo.found : "none",
          expectedParamNames: invalidParamInfo ? invalidParamInfo.expected : "none",
          extractedParams:
            Object.keys(toolParams).length > 0 ? toolParams : "none",
        });

        // Create a malformed tool action with error flag
        const actionIndex = result.actions.length;
        const malformedAction: ToolAction = {
          type: toolName as any,
          params: toolParams,
          rawXml: match[0],
          isError: true,
          errorMessage,
          errorCode,
        };

        result.contentBlocks.push({
          type: "tool",
          action: malformedAction,
          actionIndex,
        });
        result.actions.push(malformedAction);

        break;
      }
    } else {
      // No more tags, but check for partial tag prefix at the very end (e.g., "<tex", "<thinking")
      const partialTagMatch = /<[\/]?[a-zA-Z0-9_]*$/.exec(scanStr);
      if (partialTagMatch) {
        const textBeforePartial = scanStr.substring(0, partialTagMatch.index);
        if (textBeforePartial.trim()) {
          pushTextOrCodeBlocks("markdown", textBeforePartial);
        }
        // Don't show the partial tag itself - it will be completed in next stream chunk
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

  // 🔍 ALWAYS log if contentBlocks is empty (potential bug)
  const isPartialTag = /^<[\/]?[a-zA-Z0-9_]*$/.test(content.trim());
  if (
    result.contentBlocks.length === 0 &&
    content.trim().length > 0 &&
    !isPartialTag
  ) {
    console.warn("[Zen][Parser] ⚠️ No contentBlocks generated!", {
      contentLength: content.length,
      contentPreview: content.substring(0, 200),
      remainingAfterThinking: remainingContent.substring(0, 100),
    });
  }

  // 🛡️ DETECT ONLY-THINKING RESPONSE (fallback mechanism)
  // If response has thinking blocks BUT no other content or tools, mark it
  const hasThinkingBlocks = thinkingBlocks.length > 0;

  // Check if there are non-thinking content blocks or actions
  const nonThinkingBlocks = result.contentBlocks.filter(
    (block) => block.type !== "thinking",
  );
  const hasOtherContent =
    nonThinkingBlocks.length > 0 || result.actions.length > 0;

  if (hasThinkingBlocks && !hasOtherContent && content.trim().length > 100) {
    // Only mark if content is substantial (> 100 chars) to avoid false positives
    result.onlyThinkingDetected = true;
    console.warn("[Zen][Parser] ⚠️ ONLY-THINKING response detected!", {
      thinkingBlocksCount: thinkingBlocks.length,
      contentLength: content.length,
      totalBlocks: result.contentBlocks.length,
      nonThinkingBlocks: nonThinkingBlocks.length,
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

    case "list_files":
      const type = action.params.type ? ` [${action.params.type}]` : "";
      return `list_files: ${action.params.folder_path || "unknown"}${type}`;

    case "find_files":
      const fileCount = action.params.file_names?.length || 0;
      return `find_files: ${fileCount} file name${fileCount === 1 ? "" : "s"}`;

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
