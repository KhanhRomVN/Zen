import { assembleScope } from "./dsml/assemble";
import type { DsmlToolCall } from "./dsml/assemble";
import { findScopes, hasDsmlMarker } from "./dsml/scope";

export type DeepseekToolFormat = "xml" | "json";

export interface ProcessDeepseekContentResult {
  content: string;
  convertedToolCount: number;
}

const stringifyParam = (v: unknown): string =>
  typeof v === "string" ? v : JSON.stringify(v);

const toXml = (call: DsmlToolCall): string => {
  const { tool, params } = call;
  if (tool === "conversation_title") {
    return `<conversation_title>${stringifyParam(params.title ?? "")}</conversation_title>`;
  }
  if (tool === "read_skill") {
    return `<read_skill>${stringifyParam(params.skill_id ?? "")}</read_skill>`;
  }
  const inner = Object.entries(params)
    .map(([k, v]) => `<${k}>${stringifyParam(v)}</${k}>`)
    .join("");
  return `<${tool}>${inner}</${tool}>`;
};

const toJson = (call: DsmlToolCall): string =>
  "```json\n" +
  JSON.stringify({ tool: call.tool, params: call.params }) +
  "\n```";

export const hasDeepseekDSML = (content: string): boolean =>
  hasDsmlMarker(content);

export const processDeepseekContent = (
  content: string,
  toolFormat: DeepseekToolFormat = "xml",
): ProcessDeepseekContentResult => {
  if (!hasDeepseekDSML(content)) {
    return { content, convertedToolCount: 0 };
  }

  const scopes = findScopes(content);
  let result = "";
  let cursor = 0;
  let convertedToolCount = 0;

  for (const scope of scopes) {
    const calls = assembleScope(content, scope);
    if (calls.length === 0) continue;
    result +=
      content.slice(cursor, scope.start) +
      calls.map((c) => (toolFormat === "json" ? toJson(c) : toXml(c))).join("\n");
    cursor = scope.end;
    convertedToolCount += calls.length;
  }
  result += content.slice(cursor);

  return { content: result, convertedToolCount };
};