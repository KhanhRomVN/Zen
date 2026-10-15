const PREVIEW_MAX_CHARS = 280;

export function buildSkillPreview(skill: {
  content?: string;
  description?: string;
}): string {
  const usable = (v?: string) => (v && !/^\$(undefined|null)$/.test(v) ? v : "");
  const raw = usable(skill.content) || usable(skill.description);
  const body = raw
    .replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (body.length <= PREVIEW_MAX_CHARS) return body;
  return `${body.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…`;
}