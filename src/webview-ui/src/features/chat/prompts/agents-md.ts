export const buildAgentsMdSection = (content: string): string => {
  const body = content.trim().length > 0 ? `\n\n${content}` : "\n\n(AGENTS.md hiện đang rỗng)";
  return `\n\n# AGENTS.md
AGENTS.md is a README written for AI agents: build/test/lint commands, code style, folder structure, things not to touch, commit/PR workflow. The root AGENTS.md content is attached below (if any). Rules:
- Follow it as project-level guidance. If the user's request conflicts with it, the user's request wins.
- In a subfolder with its own AGENTS.md (common in monorepos, e.g. packages/api/AGENTS.md), the file closest to the file being edited takes priority over the root one. Use find_files to check for it and read_file to load it before editing there.
- When you learn stable, project-specific facts (commands, conventions, restrictions), record them: use replace_in_file to update an existing AGENTS.md, or write_to_file to create one (root AGENTS.md if empty; subfolder AGENTS.md only when that subfolder genuinely needs its own rules).
- Keep it short, factual, in Markdown with sections like "Dev environment tips", "Testing instructions", "PR instructions". Never store secrets.${body}`;
};