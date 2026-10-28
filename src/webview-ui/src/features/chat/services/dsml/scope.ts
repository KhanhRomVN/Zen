import { tokenize } from "./tokenizer";

export interface DsmlScope {
  start: number;
  end: number;
}

export const hasDsmlMarker = (content: string): boolean =>
  /<\s*\/?\s*[｜|▁]{0,3}\s*DSML/i.test(content);

export const findScopes = (content: string): DsmlScope[] => {
  const tokens = tokenize(content).filter((t) => t.prefixed);
  const scopes: DsmlScope[] = [];
  let start = -1;
  let last: (typeof tokens)[number] | null = null;

  for (const t of tokens) {
    if (start === -1) {
      if (t.kind === "open" && (t.name === "calls" || t.name === "invoke")) {
        start = t.start;
        last = t;
      }
      continue;
    }
    last = t;
    if (t.kind === "close" && t.name === "calls") {
      scopes.push({ start, end: t.end });
      start = -1;
      last = null;
    }
  }

  if (start !== -1 && last) {
    scopes.push({ start, end: last.kind === "open" ? content.length : last.end });
  }
  return scopes;
};