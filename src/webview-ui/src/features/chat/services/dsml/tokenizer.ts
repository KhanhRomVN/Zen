export type DsmlTagName = "calls" | "invoke" | "parameter";

export interface DsmlToken {
  kind: "open" | "close";
  name: DsmlTagName;
  attrs: Record<string, string | undefined>;
  start: number;
  end: number;
  prefixed: boolean;
}

const BARS = "[｜|▁]";

const TAG_SOURCE = String.raw`<\s*(\/)?\s*(?:(${BARS}{0,3}\s*DSML\s*${BARS}{0,3}\s*)|(?=(?:parameter|invoke|calls)\b))(parameter|invoke|calls)\b([^<>]*)(?:>|(?=<)|$)`;

const ATTR_RE = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;

const parseAttrs = (raw: string): Record<string, string | undefined> => {
  const attrs: Record<string, string | undefined> = {};
  for (const m of raw.matchAll(ATTR_RE)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
};

export const tokenize = (content: string): DsmlToken[] => {
  const tokens: DsmlToken[] = [];
  for (const m of content.matchAll(new RegExp(TAG_SOURCE, "gi"))) {
    const start = m.index ?? 0;
    const isClose = m[1] !== undefined;
    tokens.push({
      kind: isClose ? "close" : "open",
      name: m[3].toLowerCase() as DsmlTagName,
      attrs: isClose ? {} : parseAttrs(m[4]),
      start,
      end: start + m[0].length,
      prefixed: m[2] !== undefined,
    });
  }
  return tokens;
};