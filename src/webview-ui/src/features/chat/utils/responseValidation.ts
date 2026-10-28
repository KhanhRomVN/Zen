import { TAG_REGISTRY } from "../constants/constants";
import type { ParsedResponse } from "../services/ResponseParser";

const IDS_PATTERN = Object.keys(TAG_REGISTRY)
  .filter((id) => id !== "thinking")
  .join("|");

const THINKING_REGEX = /<thinking>[\s\S]*?(?:<\/thinking>|$)/gi;

const REGISTERED_TAG_REGEX = new RegExp(
  `<(?:${IDS_PATTERN})(?:\\s[^>]*)?/?>|^\\s*(?:${IDS_PATTERN})>|"(?:tool|type)"\\s*:\\s*"(?:${IDS_PATTERN})"`,
  "im",
);

// ASSUMED: leftover tool-like syntax inside a markdown block = a tool call that failed to parse
const LEFTOVER_TAG_REGEX = new RegExp(
  `<\\/?(?:(?:${IDS_PATTERN}|[a-z]+(?:_[a-z]+)+)\\b|[^\\s>]*DSML)`,
  "i",
);

const LEFTOVER_JSON_TOOL_REGEX = /"tool"\s*:\s*"|```json/;

const SEGMENT_MAX_LENGTH = 400;
const SEGMENT_HEAD_LENGTH = 280;
const SEGMENT_TAIL_LENGTH = 100;
const MAX_REPORTED_SEGMENTS = 5;

const truncateMiddle = (text: string): string =>
  text.length <= SEGMENT_MAX_LENGTH
    ? text
    : `${text.slice(0, SEGMENT_HEAD_LENGTH)}\n...\n${text.slice(-SEGMENT_TAIL_LENGTH)}`;

export const hasRegisteredTag = (raw: string): boolean =>
  REGISTERED_TAG_REGEX.test((raw || "").replace(THINKING_REGEX, ""));

export const findUnparsedSegments = (parsed: ParsedResponse): string[] =>
  parsed.contentBlocks
    .filter((block: any) => {
      if (typeof block.content !== "string") return false;
      if (block.type === "markdown")
        return (
          LEFTOVER_TAG_REGEX.test(block.content) ||
          LEFTOVER_JSON_TOOL_REGEX.test(block.content)
        );
      if (block.type === "code")
        return LEFTOVER_JSON_TOOL_REGEX.test(block.content);
      return false;
    })
    .map((block: any) => truncateMiddle(block.content.trim()));

export const buildUnparsedSegmentsWarning = (
  parsed: ParsedResponse,
): string | null => {
  const segments = findUnparsedSegments(parsed);
  if (segments.length === 0) return null;
  const executed = parsed.actions
    .filter((a) => !a.isError)
    .map((a) => a.type)
    .join(", ");
  return `[format_error] Error_message: Only these tool calls in your response were parsed and executed: ${executed || "(none)"}. The other part(s) of your response could not be parsed or are not recognized as any known tool, so they were NOT executed (likely a format error):\n${segments
    .slice(0, MAX_REPORTED_SEGMENTS)
    .map((s) => `- ${s}`)
    .join(
      "\n",
    )}${segments.length > MAX_REPORTED_SEGMENTS ? `\n- ... (+${segments.length - MAX_REPORTED_SEGMENTS} more)` : ""}\nFix the format and resend those tool calls.`;
};
