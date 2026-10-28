const TOOL_MARKER_START = "__CLAUDE_TOOL__:";
const TOOL_MARKER_END = "__END_TOOL__";

export const cleanClaudeSandboxTools = (rawContent: string): string => {
  if (!rawContent.includes(TOOL_MARKER_START)) return rawContent;

  let result = "";
  let remaining = rawContent;

  while (remaining.length > 0) {
    const startIdx = remaining.indexOf(TOOL_MARKER_START);
    if (startIdx === -1) {
      result += remaining;
      break;
    }

    result += remaining.slice(0, startIdx);
    const afterStart = remaining.slice(startIdx + TOOL_MARKER_START.length);
    const endIdx = afterStart.indexOf(TOOL_MARKER_END);

    // ASSUMED: marker without __END_TOOL__ is truncated garbage, drop it to the end
    if (endIdx === -1) break;

    remaining = afterStart.slice(endIdx + TOOL_MARKER_END.length);
  }

  return result.trim();
};