import { getAllToolTypes } from "../../constants/constants";

export type ParamKind = "string" | "number" | "boolean" | "any";

export interface ToolSchema {
  required: string[];
  params: Record<string, ParamKind>;
  dangerous?: boolean;
}

export interface ResolvedToolName {
  name: string;
  exact: boolean;
}

const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  read_file: {
    required: ["file_path"],
    params: { file_path: "string", start_line: "number", end_line: "number" },
  },
  write_to_file: {
    required: ["file_path", "content"],
    params: { file_path: "string", content: "string" },
    dangerous: true,
  },
  replace_in_file: {
    required: ["file_path", "old_content", "new_content"],
    params: {
      file_path: "string",
      old_content: "string",
      new_content: "string",
    },
    dangerous: true,
  },
  revert_file: {
    required: ["file_path"],
    params: { file_path: "string", version: "number" },
    dangerous: true,
  },
  view_replace_history: {
    required: ["file_path"],
    params: { file_path: "string" },
  },
  list_files: {
    required: ["folder_path"],
    params: { folder_path: "string", depth: "any" },
  },
  find_files: {
    required: ["file_name"],
    params: { file_name: "string", folder_path: "string" },
  },
  grep: {
    required: ["search_term"],
    params: {
      search_term: "string",
      file_path: "string",
      folder_path: "string",
    },
  },
  delete_file: {
    required: ["file_path"],
    params: { file_path: "string" },
    dangerous: true,
  },
  run_command: {
    required: ["command"],
    params: { command: "string", folder_path: "string" },
    dangerous: true,
  },
  git_status: { required: [], params: {} },
  git_diff: { required: [], params: {} },
  commit_message: { required: [], params: {} },
  read_skill: { required: ["skill_id"], params: { skill_id: "string" } },
  read_memory: { required: [], params: {} },
  update_memory: {
    required: ["old_content", "new_content"],
    params: { old_content: "string", new_content: "string" },
  },
  conversation_title: { required: ["title"], params: { title: "string" } },
};

export const getToolSchema = (name: string): ToolSchema | undefined =>
  Object.prototype.hasOwnProperty.call(TOOL_SCHEMAS, name)
    ? TOOL_SCHEMAS[name]
    : undefined;

export const allToolNames = (): string[] =>
  Array.from(new Set([...getAllToolTypes(), ...Object.keys(TOOL_SCHEMAS)]));

export const isKnownTool = (name: string): boolean =>
  allToolNames().includes(name);

export const isDangerousTool = (name: string): boolean =>
  getToolSchema(name)?.dangerous === true;

const normalizeKey = (s: string): string =>
  s.toLowerCase().replace(/[\s_-]/g, "");

const levenshtein = (a: string, b: string): number => {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length];
};

const uniqueNear = (
  candidates: string[],
  input: string,
  maxDistance: number,
): string | null => {
  const norm = normalizeKey(input);
  const sameNorm = candidates.filter((c) => normalizeKey(c) === norm);
  if (sameNorm.length === 1) return sameNorm[0];
  if (norm.length < 5) return null;
  const near = candidates.filter(
    (c) => levenshtein(normalizeKey(c), norm) <= maxDistance,
  );
  return near.length === 1 ? near[0] : null;
};

export const resolveToolName = (raw: string): ResolvedToolName | null => {
  const name = raw.trim();
  const names = allToolNames();
  if (names.includes(name)) return { name, exact: true };
  const near = uniqueNear(names, name, 2);
  return near ? { name: near, exact: false } : null;
};

export const canonicalParamName = (
  schema: ToolSchema,
  name: string,
): string => {
  const keys = Object.keys(schema.params);
  if (keys.includes(name)) return name;
  return uniqueNear(keys, name, 2) ?? name;
};

export const inferToolFromParams = (paramNames: string[]): string | null => {
  if (paramNames.length === 0) return null;
  const matches = Object.entries(TOOL_SCHEMAS).filter(
    ([, s]) =>
      s.required.every((k) => paramNames.includes(k)) &&
      paramNames.every((k) => k in s.params),
  );
  return matches.length === 1 ? matches[0][0] : null;
};