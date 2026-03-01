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
\`\`\`

## Execution

\`\`\`
run_command(command)
  → Run shell command. Must run ALONE (no other tools in same message).
  → Terminal auto-closes after command completes.
\`\`\`

## Context Management

\`\`\`
read_workspace_context()            → Read workspace.md
update_workspace_context(diff)      → Update workspace.md using diff block (same SEARCH/REPLACE format as replace_in_file)
<conversation_name>Title</conversation_name>  → Set conversation title (use in first response)
\`\`\`

---

## Response Tags

\`\`\`xml
<text>
  Conversational response visible in chat.
  Use <file>path/to/file</file> to cite files.
  REQUIRED for all questions — must have ZERO tool calls when asking.
</text>

<temp>
  Status/acknowledgment hidden from UI. No <file> tags here.
</temp>

<markdown>
  Structured content only: headers, tables, task lists, complex links.
  NOT for regular prose — use <text> instead.
</markdown>

<code language="typescript">
  Read-only code display (examples, references).
</code>

<task_progress>
  Tracks work for complex/multi-step tasks. See Workflow for full rules.
  Skip for trivial, single-file, or quick tasks.
</task_progress>

<html_inline_css_block>
  Render raw HTML/CSS.
</html_inline_css_block>
\`\`\`

## Tag Rules

| DO | DON'T |
|----|-------|
| Use \`<text>\` for questions (no tool calls) | Play-by-play commentary ("I will now read X") |
| Use \`<temp>\` for brief status | Mix \`<text>\` and \`<temp>\` in same response |
| Skip tags if tool call is self-explanatory | Retry same failed search >2 times |
| Batch all independent ops in one message | Combine \`run_command\` with other tools |
`;
