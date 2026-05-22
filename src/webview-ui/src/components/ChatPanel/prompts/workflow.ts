export const WORKFLOW = `# WORKFLOW

1. **ORIENT** — Is the task clear and file paths known? If not, ask before acting. If PROJECT STRUCTURE is missing from context, run \`<list_files><folder_path>.</folder_path><depth>1</depth></list_files>\` before proceeding.
2. **EXPLORE** — Batch all exploration (list_files, search_files) in one message. Max 2 search attempts → ask user.
3. **READ** — read_file → STOP. No text after. Wait for content before editing.
4. **EXECUTE** — Batch all independent writes/replaces in one message.
5. **VERIFY** — Tool error → diagnose root cause, fix or ask. Never silently retry.`;
