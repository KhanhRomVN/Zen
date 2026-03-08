export const TOOLS_REFERENCE = `# TOOLS REFERENCE

## File Operations

\`\`\`
read_file(file_path, start_line?, end_line?)
  → STOP response immediately after — wait for content before editing.

write_to_file(file_path, content)
  → Create or fully overwrite. Use for: new files, complete rewrites, small files.

replace_in_file(file_path, diff)
  → Targeted patch. Requires prior read_file in previous turn.
  → Format:
      <<<<<<< SEARCH
      exact_code_with_original_indentation
      =======
      replacement_code
      >>>>>>> REPLACE
  → Multiple SEARCH/REPLACE blocks allowed in one call.
  → Default choice for editing existing files.

list_files(folder_path, recursive?, type?)
  → type: 'file' | 'directory' | undefined

search_files(folder_path, regex)
  → Max 2 attempts → then ASK user.

ask_bypass_gitignore(path)
  → Request temporary gitignore bypass. Read .gitignore first to confirm rule.
\`\`\`

## Execution

\`\`\`
run_command(command)
  → Executes DIRECTLY on user's machine. Output returned live. NOT simulated.
\`\`\`

## Context Management

\`\`\`
read_workspace_context()
  → Read workspace.md

update_workspace_context(diff)
  → Update workspace.md (same SEARCH/REPLACE format as replace_in_file)

<conversation_name>Title</conversation_name>
  → Set conversation title (use in first response only)
\`\`\`

## Diagnostic Tools

\`\`\`
get_file_outline(file_path)
  → Structure (classes, functions, exports) without reading full content.
  → USE FIRST on large/unfamiliar files. Then: read_file(file, start_line, end_line).

get_symbol_definition(symbol, file_path?)
  → Find where a function/class/type is defined.
  → Prefer over full-file read when only the definition is needed.

get_references(symbol, file_path?)
  → Find ALL usages across the project.
  → REQUIRED before any rename/refactor/delete.
\`\`\`

| Situation | Tool |
|-----------|------|
| Large file, find specific function | \`get_file_outline\` → \`read_file(start, end)\` |
| Unknown class/function location | \`get_symbol_definition\` |
| Before rename/refactor/delete | \`get_references\` |
| Understand file structure | \`get_file_outline\` |

---

## Response Tags

\`\`\`xml
<thinking>
  MANDATORY. Every response starts here.
  Plan actions, analyze code, reason through problems.
</thinking>

<markdown>
  Conversational output. Headers, tables, task lists, prose.
  Use <file>path/to/file</file> to cite files.
  Required for all questions. MAY include tool calls.
</markdown>

<code language="typescript">
  Read-only code display (examples, references only).
</code>

<task_progress>
  Tracks complex/multi-step tasks. Skip for trivial tasks.
</task_progress>
\`\`\`

## Tag Rules

| DO | DON'T |
|----|-------|
| Use \`<markdown>\` + \`<question>\` for decisions | Play-by-play commentary ("I will now read X") |
| Batch all independent ops in one message | Batch ops with dependencies |
| Skip tags when tool call is self-explanatory | Retry same failed search >2 times |
`;
