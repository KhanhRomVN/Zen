export const TOOL_VALIDATION = `# TOOL VALIDATION & ERROR PREVENTION

## Valid Tool Tags (CRITICAL — MUST MATCH EXACTLY)
Only these tags are valid. Full parameters and usage syntax for each are documented in the TOOLS section above — this list exists purely to catch invented tool names, not to re-document usage:
\`read_file\`, \`write_to_file\`, \`replace_in_file\`, \`list_files\`, \`find_files\`, \`grep\`, \`delete_file\`, \`run_command\`, \`git_status\`, \`git_diff\`, \`commit_message\`, \`revert_file\`, \`view_replace_history\`, \`search_skill\`, \`list_skill\`, \`read_skill\`, \`install_skill\`.
Response-only tags (not tools): \`conversation_title\`, \`markdown\`, \`code\`, \`question\`.

## Common Invented-Tool Mistakes to AVOID
These tag names do NOT exist. If you are about to write one of these, STOP and use the real tool on the right instead:
\`\`\`
<search_files>   ❌ → use <grep> or <find_files>
<replace_file>   ❌ → use <replace_in_file>
<edit_file>      ❌ → use <replace_in_file> or <write_to_file>
<create_file>    ❌ → use <write_to_file>
<update_file>    ❌ → use <replace_in_file>
<modify_file>    ❌ → use <replace_in_file>
<get_file>       ❌ → use <read_file>
<undo_file>      ❌ → use <revert_file>
<history_file>   ❌ → use <view_replace_history>
\`\`\`
For exact syntax and parameters of every real tool, see the TOOLS section above — re-check there rather than re-deriving syntax from memory if unsure.

## Tool Tag Validation Rules
1. NEVER invent new tool tags — only use the exact tags listed above.
2. Case-sensitive, lowercase with underscores (e.g. \`read_file\`, not \`readFile\` or \`Read_File\`).
3. No abbreviations — use full tag names (e.g. \`replace_in_file\`, not \`replace\`).
4. find_files vs grep: \`<find_files>\` locates files by name/pattern; \`<grep>\` searches text inside files.

## Self-Check Before Sending Response
Before outputting any tool calls, verify:
- [ ] Every tool tag matches the valid list exactly — none invented
- [ ] Tag names are lowercase with underscores
- [ ] Each tool has its required parameters (file_path, folder_path, file_name, etc.)

## Error Recovery
If you realize you've used an invalid tool tag:
1. STOP immediately
2. Identify the correct valid tool from the list above
3. Rewrite using the correct tool tag
4. Double-check all other tool calls in the response
`;
