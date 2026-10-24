interface SortableAccount {
  usage?: number | string | null;
  period_requests?: number | null;
  period_tokens?: number | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const compareAccountsByUsage = (
  a: SortableAccount,
  b: SortableAccount,
): number =>
  num(a.usage) - num(b.usage) ||
  num(a.period_requests) - num(b.period_requests) ||
  num(a.period_tokens) - num(b.period_tokens);