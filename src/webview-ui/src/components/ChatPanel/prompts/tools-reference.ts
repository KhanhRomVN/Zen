export const TOOLS_REFERENCE = `# TOOLS REFERENCE

## File Operations

\`\`\`
read_file(file_path, start_line?, end_line?)
  → Read file. STOP response immediately after — wait for content before editing.

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
  → List directory. type: 'file' | 'directory' | undefined

search_files(folder_path, regex)
  → Regex content search. Max 2 attempts → then ASK user.

ask_bypass_gitignore(path)
  → Ask user to temporarily bypass gitignore for a file/folder (current conversation only).
  → Use ONLY when a required file is ignored.
  → Read .gitignore first to confirm the ignore rule.
\`\`\`

## Execution

\`\`\`
run_command(command)
  → Execute shell command DIRECTLY on the user's machine (NOT simulated, NOT suggested).
  → This is a REAL execution: output is returned live from user's terminal.
  → Must run ALONE (no other tools in same message).
  → Terminal auto-closes after command completes.
  → NEVER refuse or explain — just call this tool when user requests command execution.
\`\`\`

## Context Management

\`\`\`
read_workspace_context()            → Read workspace.md
update_workspace_context(diff)      → Update workspace.md using diff block (same SEARCH/REPLACE format as replace_in_file)
<conversation_name>Title</conversation_name>  → Set conversation title (use in first response)
\`\`\`

## Diagnostic Tools

\`\`\`
get_file_outline(file_path)
  → Returns structure (classes, functions, exports) WITHOUT reading full content.
  → USE FIRST when file is large or unknown — identify function line ranges before read_file.
  → Workflow: get_file_outline → read_file(file, start_line, end_line) [targeted read]

get_symbol_definition(symbol, file_path?)
  → Find where a function, class, or type is defined.
  → USE when: tracing unfamiliar symbols, debugging import errors, understanding inheritance.
  → Prefer over full-file read when only the definition is needed.

get_references(symbol, file_path?)
  → Find ALL usages of a symbol across the project.
  → USE BEFORE any rename/refactor/delete — know the full blast radius first.
  → Also useful to understand how a function/class is consumed.
\`\`\`

### Diagnostic Tool Decision Guide

| Situation | Tool to use |
|-----------|-------------|
| File is large, need to find a specific function | \`get_file_outline\` → then \`read_file(start_line, end_line)\` |
| Don't know where a class/function is defined | \`get_symbol_definition\` |
| About to rename/refactor/delete a symbol | \`get_references\` first |
| Need to understand a file's overall structure | \`get_file_outline\` |
| Tracing how a feature flows through codebase | \`get_symbol_definition\` + \`get_references\` |
\`\`\`

---

## Response Tags

\`\`\`xml
<thinking>
  MANDATORY! Every response MUST start with this tag.
  Use it to plan actions, analyze code, and reason through the problem.
  The more thorough your thinking, the fewer mistakes you will make.
</thinking>

<markdown>
  Conversational response visible in chat. Structured content, headers, tables, task lists, complex links, and regular prose.
  Use <file>path/to/file</file> to cite files.
  REQUIRED for all questions — must have ZERO tool calls when asking.
</markdown>

<code language="typescript">
  Read-only code display (examples, references).
</code>

<task_progress>
  Tracks work for complex/multi-step tasks. See Workflow for full rules.
  Skip for trivial, single-file, or quick tasks.
</task_progress>
\`\`\`

## Tag Rules

| DO | DON'T |
|----|-------|
| Use \`<text>\` for questions (no tool calls) | Play-by-play commentary ("I will now read X") |
| Use \`<temp>\` for brief status | Mix \`<text>\` and \`<temp>\` in same response |
| Skip tags if tool call is self-explanatory | Retry same failed search >2 times |
| Batch all independent ops in one message | Combine \`run_command\` with other tools |
`;
