export const TOOLS_REFERENCE = `# TOOLS

Use XML tags for all tool calls:

<read_file><file_path>path/to/file</file_path></read_file>
<read_file><file_path>path/to/file</file_path><start_line>1</start_line><end_line>50</end_line></read_file>

<write_to_file><file_path>path/to/file</file_path><content>full file content</content></write_to_file>

<replace_in_file><file_path>path/to/file</file_path><diff>
<<<<<<< SEARCH
exact original (indentation must match)
=======
replacement
>>>>>>> REPLACE
</diff></replace_in_file>

<list_files><folder_path>path/to/folder</folder_path></list_files>
<list_files><folder_path>path/to/folder</folder_path><depth>2</depth></list_files>

<search_files><folder_path>path/to/folder</folder_path><regex>pattern</regex></search_files>

<delete_file><file_path>path/to/file</file_path></delete_file>

<delete_folder><folder_path>path/to/folder</folder_path></delete_folder>

<run_command><command>your command here</command></run_command>

**run_command stdin/prompt rules**: stdin is a pipe (not a TTY). "read -p" suppresses its prompt when stdin is not a TTY. To show a prompt to the user, use "printf ... >&2" before "read":
  - broken: read -p "Enter value: " x
  - correct: printf "Enter value: " >&2; read x

**run_command exit codes**: A non-zero exit code means the command failed. If the output contains "Error - Exit code N", treat the command as failed and diagnose before continuing.

# RESPONSE TAGS

<thinking>your private two-pass reasoning and planning</thinking>
<markdown>prose, tables, explanations</markdown>
<code language="ts">read-only display</code>
<question><option>A</option><option>B</option></question>

## Plan Tag (optional, for long multi-step tasks only)

Use <plan> ONLY when the task is clearly long (5+ major phases or touches many files across multiple systems). It is a high-level progress tracker shown to the user — steps must be broad and conceptual, NOT granular sub-operations.

**Rules:**
- Use at most 3–6 steps total. Each step = one high-level phase (e.g. "Read source files", "Refactor auth module", "Run tests").
- Do NOT create a step for each individual file read or small edit.
- Re-emit the full <plan> block each time you update step statuses (done/in_progress/pending).
- status values: "done" | "in_progress" | "pending"
- Omit entirely for short or single-turn tasks.

**Example (emit at start of a long task):**
<plan>
  <step id="1" status="in_progress">Explore project structure</step>
  <step id="2" status="pending">Refactor authentication module</step>
  <step id="3" status="pending">Update API routes</step>
  <step id="4" status="pending">Run and verify tests</step>
</plan>

**Example (update mid-task, in a tool turn — NO markdown in same message):**
<plan>
  <step id="1" status="done">Explore project structure</step>
  <step id="2" status="done">Refactor authentication module</step>
  <step id="3" status="in_progress">Update API routes</step>
  <step id="4" status="pending">Run and verify tests</step>
</plan>

Never output a <markdown> block in the same message with tool calls. Wait for tool results in the next turn before writing any markdown.
After each read_file, STOP and wait for the file content before proceeding.`;
