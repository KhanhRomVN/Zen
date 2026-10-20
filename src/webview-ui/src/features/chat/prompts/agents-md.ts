export const buildAgentsMdSection = (content: string): string => {
  const body = content.trim().length > 0 ? `\n\n${content}` : "\n\n(AGENTS.md hiện đang rỗng)";
  return `\n\n# AGENTS.md
AGENTS.md is a README written for AI agents: build/test/lint commands, code style, folder structure, things not to touch, commit/PR workflow. The root AGENTS.md content is attached below (if any). Rules:
- Follow it as project-level guidance. If the user's request conflicts with it, the user's request wins.
- In a subfolder with its own AGENTS.md (common in monorepos, e.g. packages/api/AGENTS.md), the file closest to the file being edited takes priority over the root one. Use find_files to check for it and read_file to load it before editing there.
- Record durable, project-specific facts you learn (build/test/lint commands, code style, folder structure, things not to touch, workflow) into the ROOT AGENTS.md. If AGENTS.md is shown below as empty, write its content with write_to_file (file_path "AGENTS.md"); if it already has content, use replace_in_file with an exact snippet (read_file it first if unsure it is current). Updating AGENTS.md is explicitly allowed and is NOT limited by SCOPE-LOCK. Do it at the end of a task (see the LEARN step in WORKFLOW) whenever you discovered such a fact that is not already written there. Use a subfolder AGENTS.md only when that subfolder genuinely needs its own rules.
- Keep it short, factual, in Markdown with sections like "Dev environment tips", "Testing instructions", "PR instructions". Never store secrets.${body}`;
};