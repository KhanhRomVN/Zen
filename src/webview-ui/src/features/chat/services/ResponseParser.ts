import { normalizeTagVariants } from "../utils/TagNormalizer";
import { parseToolAction } from "../utils/ToolParser";
import {
  getAllToolTypes,
  type ExecutableToolType,
} from "../constants/tool-registry";
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
}

export interface ToolAction {
  type: ExecutableToolType | "context_compression" | "thinking" | "question";
  params: Record<string, any>;
  rawXml: string;
  isPartial?: boolean;
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
  | { type: "thinking"; content: string };

/**
 * Parse AI response to extract tool actions
 * Supports interleaved text and tool calls
 */
// Enable debug logs via localStorage
const DEBUG_PARSER =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("zen_debug_parser") === "true";

export const parseAIResponse = (content: string): ParsedResponse => {
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
  const {
    remainingContent: contentAfterThinking,
    thinkingBlocks,
    unclosedThinkingContent,
  } = extractThinkingBlocks(remainingContent);

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
          // It's a tool - delegate to individual tag parsers
          const actionIndex = result.actions.length;
          let action: ToolAction;

          switch (toolName) {
            case "read_file": {
              const params = parseReadFile(innerContent || "");
              action = { type: "read_file" as const, params, rawXml };
              break;
            }
            case "write_to_file": {
              const params = parseWriteToFile(innerContent || "");
              action = { type: "write_to_file" as const, params, rawXml };
              break;
            }
            case "replace_in_file": {
              const params = parseReplaceInFile(innerContent || "");
              action = { type: "replace_in_file" as const, params, rawXml };
              break;
            }
            case "list_files": {
              const params = parseListFiles(innerContent || "");
              action = { type: "list_files" as const, params, rawXml };
              break;
            }
            case "find_files": {
              const params = parseFindFiles(innerContent || "");
              action = { type: "find_files" as const, params, rawXml };
              break;
            }
            case "grep": {
              const params = parseGrep(innerContent || "");
              action = { type: "grep" as const, params, rawXml };
              break;
            }
            case "delete_file": {
              const params = parseDeleteFile(innerContent || "");
              action = { type: "delete_file" as const, params, rawXml };
              break;
            }
            case "delete_folder": {
              const params = parseDeleteFolder(innerContent || "");
              action = { type: "delete_folder" as const, params, rawXml };
              break;
            }
            case "move_file": {
              const params = parseMoveFile(innerContent || "");
              action = { type: "move_file" as const, params, rawXml };
              break;
            }
            case "revert_file": {
              const params = parseRevertFile(innerContent || "");
              action = { type: "revert_file" as const, params, rawXml };
              break;
            }
            case "run_command": {
              const params = parseRunCommand(innerContent || "");
              action = { type: "run_command" as const, params, rawXml };
              break;
            }
            case "git_status": {
              const params = parseGitStatus(innerContent || "");
              action = { type: "git_status" as const, params, rawXml };
              break;
            }
            case "git_diff": {
              const params = parseGitDiff(innerContent || "");
              action = { type: "git_diff" as const, params, rawXml };
              break;
            }
            case "commit_message": {
              const params = parseCommitMessage(innerContent || "");
              action = { type: "commit_message" as const, params, rawXml };
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

          // Enhanced recovery logic for read_file
          if (toolName === "read_file") {
            // Try to extract file_path - support both closed and unclosed tags
            const filePathClosedRegex = /<file_path>([\s\S]*?)<\/file_path>/i;
            const filePathUnclosedRegex = /<file_path>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(filePathClosedRegex);
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(filePathUnclosedRegex)
              : null;

            const filePathValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (filePathValue && filePathValue.length > 0) {
              // Recovery condition met: we have a valid file path
              // Build a fully-closed XML with whatever content we have
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</read_file>";
              const action = parseToolAction(
                "read_file",
                innerContent || "",
                recoveredRawXml,
              );
              // action.isPartial is intentionally NOT set - allow auto-execution
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // Enhanced recovery logic for list_files
          if (toolName === "list_files") {
            // Try to extract folder_path - support both closed and unclosed tags
            const folderPathClosedRegex =
              /<folder_path>([\s\S]*?)<\/folder_path>/i;
            const folderPathUnclosedRegex = /<folder_path>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(
              folderPathClosedRegex,
            );
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(folderPathUnclosedRegex)
              : null;

            const folderPathValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (folderPathValue && folderPathValue.length > 0) {
              // Recovery condition met: we have a valid folder path
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</list_files>";
              const params = parseListFiles(innerContent || "");
              const action = {
                type: "list_files" as const,
                params,
                rawXml: recoveredRawXml,
              };
              // action.isPartial is intentionally NOT set - allow auto-execution
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // Enhanced recovery logic for other common tools
          // write_to_file: requires file_path
          if (toolName === "write_to_file") {
            const filePathClosedRegex = /<file_path>([\s\S]*?)<\/file_path>/i;
            const filePathUnclosedRegex = /<file_path>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(filePathClosedRegex);
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(filePathUnclosedRegex)
              : null;

            const filePathValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (filePathValue && filePathValue.length > 0) {
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</write_to_file>";
              const params = parseWriteToFile(innerContent || "");
              const action = {
                type: "write_to_file" as const,
                params,
                rawXml: recoveredRawXml,
                isPartial: true, // Always partial during streaming
              };
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // replace_in_file: auto-recover missing closing tag
          // If we have both old_content and new_content (or old_str/new_str), treat as complete
          if (toolName === "replace_in_file") {
            // Check if we have both required content tags
            const hasOldContent =
              /<old_content>[\s\S]*?<\/old_content>/i.test(
                innerContent || "",
              ) || /<old_str>[\s\S]*?<\/old_str>/i.test(innerContent || "");
            const hasNewContent =
              /<new_content>[\s\S]*?<\/new_content>/i.test(
                innerContent || "",
              ) || /<new_str>[\s\S]*?<\/new_str>/i.test(innerContent || "");

            // If we have both content blocks, auto-complete the tag
            if (hasOldContent && hasNewContent) {
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</replace_in_file>";
              const params = parseReplaceInFile(innerContent || "");
              const action = {
                type: "replace_in_file" as const,
                params,
                rawXml: recoveredRawXml,
                isPartial: false, // Mark as complete since we have all required content
              };
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }

            // Otherwise, check for file_path for partial streaming recovery
            const filePathClosedRegex = /<file_path>([\s\S]*?)<\/file_path>/i;
            const filePathUnclosedRegex = /<file_path>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(filePathClosedRegex);
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(filePathUnclosedRegex)
              : null;

            const filePathValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (filePathValue && filePathValue.length > 0) {
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</replace_in_file>";
              const params = parseReplaceInFile(innerContent || "");
              const action = {
                type: "replace_in_file" as const,
                params,
                rawXml: recoveredRawXml,
                isPartial: true, // Always partial during streaming
              };
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // run_command: requires command
          if (toolName === "run_command") {
            const commandClosedRegex = /<command>([\s\S]*?)<\/command>/i;
            const commandUnclosedRegex = /<command>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(commandClosedRegex);
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(commandUnclosedRegex)
              : null;

            const commandValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (commandValue && commandValue.length > 0) {
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</run_command>";
              const action = parseToolAction(
                "run_command",
                innerContent || "",
                recoveredRawXml,
              );
              // action.isPartial is intentionally NOT set - allow auto-execution
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // grep: requires search_term or pattern
          if (toolName === "grep") {
            // Check for search_term (primary) or pattern (fallback)
            const searchTermClosedRegex =
              /<search_term>([\s\S]*?)<\/search_term>/i;
            const searchTermUnclosedRegex = /<search_term>([^\<]*?)$/i;
            const patternClosedRegex = /<pattern>([\s\S]*?)<\/pattern>/i;
            const patternUnclosedRegex = /<pattern>([^\<]*?)$/i;

            const searchTermClosedMatch = (innerContent || "").match(
              searchTermClosedRegex,
            );
            const searchTermUnclosedMatch = !searchTermClosedMatch
              ? (innerContent || "").match(searchTermUnclosedRegex)
              : null;
            const patternClosedMatch = (innerContent || "").match(
              patternClosedRegex,
            );
            const patternUnclosedMatch = !patternClosedMatch
              ? (innerContent || "").match(patternUnclosedRegex)
              : null;

            const searchTermValue =
              searchTermClosedMatch?.[1]?.trim() ||
              searchTermUnclosedMatch?.[1]?.trim() ||
              patternClosedMatch?.[1]?.trim() ||
              patternUnclosedMatch?.[1]?.trim();

            if (searchTermValue && searchTermValue.length > 0) {
              const recoveredRawXml = rawXml + (innerContent || "") + "</grep>";
              const action = parseToolAction(
                "grep",
                innerContent || "",
                recoveredRawXml,
              );
              // action.isPartial is intentionally NOT set - allow auto-execution
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            } else {
              console.warn(
                "[Zen][ResponseParser] ⚠️ Grep recovery failed: no search_term or pattern found",
              );
              console.warn(
                "[Zen][ResponseParser] innerContent preview:",
                innerContent?.substring(0, 300),
              );
            }
          }

          // delete_file: requires file_path
          if (toolName === "delete_file") {
            const filePathClosedRegex = /<file_path>([\s\S]*?)<\/file_path>/i;
            const filePathUnclosedRegex = /<file_path>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(filePathClosedRegex);
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(filePathUnclosedRegex)
              : null;

            const filePathValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (filePathValue && filePathValue.length > 0) {
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</delete_file>";
              const action = parseToolAction(
                "delete_file",
                innerContent || "",
                recoveredRawXml,
              );
              // action.isPartial is intentionally NOT set - allow auto-execution
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // delete_folder: requires folder_path
          if (toolName === "delete_folder") {
            const folderPathClosedRegex =
              /<folder_path>([\s\S]*?)<\/folder_path>/i;
            const folderPathUnclosedRegex = /<folder_path>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(
              folderPathClosedRegex,
            );
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(folderPathUnclosedRegex)
              : null;

            const folderPathValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (folderPathValue && folderPathValue.length > 0) {
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</delete_folder>";
              const action = parseToolAction(
                "delete_folder",
                innerContent || "",
                recoveredRawXml,
              );
              // action.isPartial is intentionally NOT set - allow auto-execution
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // move_file: requires source_path and dest_path
          if (toolName === "move_file") {
            const sourcePathClosedRegex =
              /<source_path>([\s\S]*?)<\/source_path>/i;
            const sourcePathUnclosedRegex = /<source_path>([^\<]*?)$/i;

            const closedMatch = (innerContent || "").match(
              sourcePathClosedRegex,
            );
            const unclosedMatch = !closedMatch
              ? (innerContent || "").match(sourcePathUnclosedRegex)
              : null;

            const sourcePathValue =
              closedMatch?.[1]?.trim() || unclosedMatch?.[1]?.trim();

            if (sourcePathValue && sourcePathValue.length > 0) {
              const recoveredRawXml =
                rawXml + (innerContent || "") + "</move_file>";
              const action = parseToolAction(
                "move_file",
                innerContent || "",
                recoveredRawXml,
              );
              // Only allow auto-execution if we also have dest_path started
              const hasDestPath = /<dest_path>/i.test(innerContent || "");
              if (!hasDestPath) {
                action.isPartial = true;
              }
              result.contentBlocks.push({ type: "tool", action, actionIndex });
              result.actions.push(action);
              break;
            }
          }

          // Fallback: tool doesn't meet recovery conditions - mark as partial
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

  // Append unclosed thinking block at the end (streaming case)
  if (unclosedThinkingContent !== null) {
    result.contentBlocks.push({
      type: "thinking",
      content: unclosedThinkingContent,
    });
  }

  // 🔍 ALWAYS log if contentBlocks is empty (potential bug)
  // BUT skip warning if content is just a partial opening tag (streaming case)
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
