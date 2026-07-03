import { extractParamValue } from "../../utils/ToolParser";
import type { CodeBlock } from "../../types/tool-types";

export const parseCode = (innerContent: string): CodeBlock => {
  const language = extractParamValue(innerContent, "language") || "text";
  const content = extractParamValue(innerContent, "content") || innerContent.trim();
  return { content, language };
};