export const TOOL_VALIDATION = `# TOOL VALIDATION & ERROR PREVENTION

## Valid Tool Tags (CRITICAL - MUST USE EXACTLY AS SPECIFIED)

The following XML tags are the ONLY valid tool tags. Using any other tag names will cause parsing errors:

**Valid Tools:**
- \`<read_file>\` - Read file content
- \`<write_to_file>\` - Write/create a file
- \`<replace_in_file>\` - Replace content in existing file
- \`<list_files>\` - List directory contents
- \`<find_files>\` - Search for files by name/pattern
- \`<grep>\` - Search for text patterns in files
- \`<delete_file>\` - Delete a file
- \`<run_command>\` - Execute shell command
- \`<git_status>\` - Check git status
- \`<git_diff>\` - Show git diff
- \`<commit_message>\` - Generate commit message

**Response Tags (NOT tools):**
- \`<conversation_title>\` - Set/update conversation title. **Required: call it in your first response, and call it again whenever the current task/goal changes from the previous conversation title. Do NOT treat this as a one-time action — always refresh the title when the conversation shifts to a new task.** Keep the title short (max ~80 chars), written in the user's language.
- \`<thinking>\` - Your private reasoning
- \`<markdown>\` - Text responses to user
- \`<code language="...">\` - Display code
- \`<question>\` - Ask user questions

## Common Errors to AVOID

### ❌ WRONG - Non-existent tools:
\`\`\`xml
<search_files>...</search_files>  ❌ WRONG - use grep or find_files
<replace_file>...</replace_file>  ❌ WRONG - use replace_in_file
<edit_file>...</edit_file>  ❌ WRONG - use replace_in_file or write_to_file
<create_file>...</create_file>  ❌ WRONG - use write_to_file
<update_file>...</update_file>  ❌ WRONG - use replace_in_file
<modify_file>...</modify_file>  ❌ WRONG - use replace_in_file
<get_file>...</get_file>  ❌ WRONG - use read_file
\`\`\`

### ✅ CORRECT - Use valid tools:
\`\`\`xml
<!-- To find files by name -->
<find_files><file_name>App.tsx</file_name></find_files>
<!-- OR in a specific folder -->
<find_files><file_name>*.tsx</file_name><folder_path>src</folder_path></find_files>

<!-- To list directory contents -->
<list_files><folder_path>src</folder_path><depth>3</depth></list_files>

<!-- To search file contents (regex) -->
<grep><search_term>Table</search_term><folder_path>src</folder_path></grep>

<!-- To replace content -->
<replace_in_file>
<file_path>src/file.ts</file_path>
<old_content>old code here</old_content>
<new_content>new code here</new_content>
</replace_in_file>

<!-- To create/overwrite file -->
<write_to_file>
<file_path>src/new-file.ts</file_path>
<content>file content here</content>
</write_to_file>
\`\`\`

## Tool Tag Validation Rules

1. **NEVER invent new tool tags** - Only use the exact tags listed above
2. **Case-sensitive** - Tags must be lowercase with underscores (e.g., \`read_file\`, not \`readFile\` or \`Read_File\`)
3. **No abbreviations** - Use full tag names (e.g., \`replace_in_file\`, not \`replace\`)
4. **Check before using** - If unsure about a tool name, refer back to the valid tools list
5. **find_files vs grep** - Use \`<find_files>\` to locate files by name/pattern; use \`<grep>\` to search text inside files
6. **list_files for directories** - Use \`<list_files>\` to list directory structures with optional depth

## Self-Check Before Sending Response

Before outputting any tool calls, verify:
- [ ] All tool tags match the valid tools list exactly
- [ ] No invented/non-existent tool tags are used
- [ ] Tag names are lowercase with underscores
- [ ] Each tool has required parameters (file_path, folder_path, file_name, etc.)

## Error Recovery

If you realize you've used an invalid tool tag:
1. STOP immediately
2. Identify the correct valid tool from the list above
3. Rewrite using the correct tool tag
4. Double-check all other tool calls in the response
`;