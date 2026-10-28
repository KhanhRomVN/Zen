import { tokenize } from "./tokenizer";
import type { DsmlToken } from "./tokenizer";
import type { DsmlScope } from "./scope";
import {
  canonicalParamName,
  getToolSchema,
  inferToolFromParams,
  isDangerousTool,
  isKnownTool,
  resolveToolName,
} from "./schema";
import type { ParamKind } from "./schema";

export interface DsmlToolCall {
  tool: string;
  params: Record<string, unknown>;
}

interface RawParam {
  name: string;
  isString?: string;
  raw: string;
}

interface RawInvoke {
  name: string | null;
  params: RawParam[];
}

const isStructuralBreak = (t: DsmlToken): boolean =>
  t.name !== "parameter" || (t.kind === "open" && t.attrs.name !== undefined);

const isValidatedClose = (
  tokens: DsmlToken[],
  index: number,
  text: string,
): boolean => {
  const next = tokens[index + 1];
  const between = text.slice(
    tokens[index].end,
    next ? next.start : text.length,
  );
  return between.trim() === "";
};

const findValueEnd = (
  tokens: DsmlToken[],
  index: number,
  text: string,
): { valueEnd: number; nextIndex: number } => {
  const strict = tokens[index].attrs.string === "true";
  for (let j = index + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.kind === "close" && t.name === "parameter") {
      if (!strict || isValidatedClose(tokens, j, text)) {
        return { valueEnd: t.start, nextIndex: j + 1 };
      }
    } else if (!strict && isStructuralBreak(t)) {
      return { valueEnd: t.start, nextIndex: j };
    }
  }
  if (strict) {
    for (let j = index + 1; j < tokens.length; j++) {
      if (isStructuralBreak(tokens[j])) {
        return { valueEnd: tokens[j].start, nextIndex: j };
      }
    }
  }
  return { valueEnd: text.length, nextIndex: tokens.length };
};

const collectInvokes = (text: string, tokens: DsmlToken[]): RawInvoke[] => {
  const invokes: RawInvoke[] = [];
  const state: { cur: RawInvoke | null } = { cur: null };
  const flush = (): void => {
    if (state.cur) invokes.push(state.cur);
    state.cur = null;
  };

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.name === "invoke") {
      flush();
      if (t.kind === "open") {
        state.cur = { name: t.attrs.name ?? null, params: [] };
      }
      i++;
      continue;
    }
    if (
      t.name === "parameter" &&
      t.kind === "open" &&
      t.attrs.name !== undefined
    ) {
      const { valueEnd, nextIndex } = findValueEnd(tokens, i, text);
      const param: RawParam = {
        name: t.attrs.name,
        isString: t.attrs.string,
        raw: text.slice(t.end, valueEnd),
      };
      if (state.cur?.params.some((p) => p.name === param.name)) flush();
      if (!state.cur) state.cur = { name: null, params: [] };
      state.cur.params.push(param);
      i = nextIndex;
      continue;
    }
    i++;
  }
  flush();
  return invokes;
};

const tryParseObject = (raw: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
};

const coerceValue = (
  kind: ParamKind | undefined,
  raw: string,
  isString: string | undefined,
): unknown => {
  const trimmed = raw.trim();
  if (kind === "string") {
    if (isString === "false") {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (typeof parsed === "string") return parsed;
      } catch {
        return raw;
      }
    }
    return raw;
  }
  if (kind === "number") {
    return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : raw;
  }
  if (kind === "boolean") {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return raw;
  }
  if (isString === "true" && kind === undefined) return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
};

const resolveInvoke = (inv: RawInvoke): DsmlToolCall | null => {
  let tool: string | null = null;
  let exact = false;
  const rest = [...inv.params];

  if (inv.name) {
    const r = resolveToolName(inv.name);
    if (r) {
      tool = r.name;
      exact = r.exact;
    }
  }

  if (!tool) {
    const idx = rest.findIndex((p) => p.raw.trim() === "" && isKnownTool(p.name));
    if (idx !== -1) {
      tool = rest[idx].name;
      exact = true;
      rest.splice(idx, 1);
    }
  }

  if (!tool) {
    const idx = rest.findIndex((p) => p.name === "tool");
    if (idx !== -1) {
      const r = resolveToolName(rest[idx].raw);
      if (r) {
        tool = r.name;
        exact = r.exact;
        rest.splice(idx, 1);
      }
    }
  }

  if (!tool) {
    tool = inferToolFromParams(rest.map((p) => p.name));
    exact = false;
  }

  if (!tool) return null;
  if (isDangerousTool(tool) && !exact) return null;

  const schema = getToolSchema(tool);
  const params: Record<string, unknown> = {};
  for (const p of rest) {
    if (p.name === "params") {
      const obj = tryParseObject(p.raw);
      if (obj) {
        Object.assign(params, obj);
        continue;
      }
      if (["", "false", "null"].includes(p.raw.trim())) continue;
    }
    const key = schema ? canonicalParamName(schema, p.name) : p.name;
    params[key] = coerceValue(schema?.params[key], p.raw, p.isString);
  }

  if (schema && !schema.required.every((k) => params[k] !== undefined)) {
    return null;
  }
  return { tool, params };
};

export const assembleScope = (
  content: string,
  scope: DsmlScope,
): DsmlToolCall[] => {
  const text = content.slice(scope.start, scope.end);
  return collectInvokes(text, tokenize(text))
    .map(resolveInvoke)
    .filter((c): c is DsmlToolCall => c !== null);
};