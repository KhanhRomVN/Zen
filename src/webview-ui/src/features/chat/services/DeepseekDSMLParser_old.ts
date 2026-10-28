import { getAllToolTypes } from "../constants/constants";

export type DeepseekToolFormat = "xml" | "json";

export interface ProcessDeepseekContentResult {
  content: string;
  convertedToolCount: number;
}

interface DsmlToolCall {
  tool: string;
  params: Record<string, unknown>;
}

const BAR = "[｜|]{1,2}";
const OPEN = `<${BAR}DSML${BAR}`;
const CLOSE = `</${BAR}DSML${BAR}`;

const CALLS_RE = new RegExp(
  `${OPEN}\\s+calls\\s*>([\\s\\S]*?)${CLOSE}\\s+calls\\s*>`,
  "g",
);
const INVOKE_RE = new RegExp(
  `${OPEN}\\s+invoke\\s+name="([^"]+)"\\s*>([\\s\\S]*?)${CLOSE}\\s+invoke\\s*>`,
  "g",
);
const PARAM_OPEN = `<(?:${BAR}DSML${BAR}\\s+)?`;
const PARAM_CLOSE = `</(?:${BAR}DSML${BAR}\\s+)?`;
const PARAM_RE = new RegExp(
  `${PARAM_OPEN}parameter\\s+name="([^"]+)"(?:\\s+string="(true|false)")?\\s*>([\\s\\S]*?)${PARAM_CLOSE}parameter\\s*>`,
  "g",
);

const isValidTool = (name: string): boolean => getAllToolTypes().includes(name);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isOnlyWhitespace = (s: string): boolean => s.trim().length === 0;

const WRAPPER_RE = new RegExp(
  `^\\s*${PARAM_OPEN}parameter\\s+name="([^"]+)"\\s*>(?=\\s*${PARAM_OPEN}parameter\\s)`,
);

const MALFORMED_WRAPPER_RE = new RegExp(
  `^\\s*${PARAM_OPEN}parameter\\s+name="([^"<\\s]+)${PARAM_CLOSE}parameter\\s*>`,
);

const parseInvoke = (
  invokeName: string,
  invokeBody: string,
): DsmlToolCall | null => {
  let name = invokeName;
  let body = invokeBody;
  const wrapper = isValidTool(name)
    ? null
    : (body.match(WRAPPER_RE) ?? body.match(MALFORMED_WRAPPER_RE));
  if (wrapper && isValidTool(wrapper[1])) {
    name = wrapper[1];
    body = body.slice(wrapper[0].length);
  }

  const params: Record<string, unknown> = {};
  for (const m of body.matchAll(PARAM_RE)) {
    const paramName = m[1];
    const isString = m[2];
    const raw = m[3];

    let value: unknown = raw;
    if (isString !== "true") {
      try {
        value = JSON.parse(raw.trim());
      } catch {
        if (isString === "false") return null;
        value = raw;
      }
    }

    if (paramName === "params" && isString === "false") {
      if (value === false || value === null) continue;
      if (!isPlainObject(value)) return null;
      Object.assign(params, value);
    } else {
      params[paramName] = value;
    }
  }

  if (!isOnlyWhitespace(body.replace(PARAM_RE, ""))) return null;

  if (isValidTool(name)) return { tool: name, params };

  const { tool: toolParam, ...rest } = params;
  if (typeof toolParam === "string" && isValidTool(toolParam)) {
    return { tool: toolParam, params: rest };
  }
  return null;
};

const parseCallsBlock = (body: string): DsmlToolCall[] | null => {
  const calls: DsmlToolCall[] = [];
  for (const m of body.matchAll(INVOKE_RE)) {
    const call = parseInvoke(m[1], m[2]);
    if (!call) return null;
    calls.push(call);
  }
  if (calls.length === 0) return null;
  if (!isOnlyWhitespace(body.replace(INVOKE_RE, ""))) return null;
  return calls;
};

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
  new RegExp(`${OPEN}\\s+calls\\s*>`).test(content);

export const processDeepseekContent = (
  content: string,
  toolFormat: DeepseekToolFormat = "xml",
): ProcessDeepseekContentResult => {
  if (!hasDeepseekDSML(content)) {
    return { content, convertedToolCount: 0 };
  }

  let convertedToolCount = 0;
  const converted = content.replace(CALLS_RE, (whole, body: string) => {
    const calls = parseCallsBlock(body);
    if (!calls) return whole;
    convertedToolCount += calls.length;
    return calls
      .map((c) => (toolFormat === "json" ? toJson(c) : toXml(c)))
      .join("\n");
  });

  return { content: converted, convertedToolCount };
};
