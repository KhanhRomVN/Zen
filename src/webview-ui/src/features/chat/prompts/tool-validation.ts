export const TOOL_VALIDATION = `# TOOL VALIDATION & ERROR PREVENTION

## Valid Tool Tags (CRITICAL - MUST USE EXACTLY AS SPECIFIED)

The following XML tags are the ONLY valid tool tags. Using any other tag names will cause parsing errors:

**Valid Tools:**
- \`<read_file>\` - Read file content
- \`<write_to_file>\` - Write/create a file
- \`<replace_in_file>\` - Replace content in existing file
- \`<list_files>\` - List directory contents
- \`<grep>\` - Search for text patterns in files
- \`<delete_file>\` - Delete a file
- \`<move_file>\` - Move or rename a file
- \`<run_command>\` - Execute shell command
- \`<git_status>\` - Check git status
- \`<git_diff>\` - Show git diff
- \`<commit_message>\` - Generate commit message

**Response Tags (NOT tools):**
- \`<thinking>\` - Your private reasoning
- \`<markdown>\` - Text responses to user
- \`<code language="...">\` - Display code
- \`<question>\` - Ask user questions

## Common Errors to AVOID

### ❌ WRONG - Non-existent tools:
\`\`\`xml
<find_files><pattern>*.tsx</pattern></find_files>  ❌ WRONG - use grep or list_files instead
<search_files>...</search_files>  ❌ WRONG - use grep
<replace_file>...</replace_file>  ❌ WRONG - use replace_in_file
<edit_file>...</edit_file>  ❌ WRONG - use replace_in_file or write_to_file
<create_file>...</create_file>  ❌ WRONG - use write_to_file
<update_file>...</update_file>  ❌ WRONG - use replace_in_file
<modify_file>...</modify_file>  ❌ WRONG - use replace_in_file
<get_file>...</get_file>  ❌ WRONG - use read_file
\`\`\`

### ✅ CORRECT - Use valid tools:
\`\`\`xml
<!-- To find files by name/pattern -->
<grep><search_term>.*\\.tsx$</search_term><folder_path>src</folder_path></grep>
<!-- OR -->
<list_files><folder_path>src</folder_path><depth>3</depth></list_files>
<!-- OR with unlimited depth -->
<list_files><folder_path>src</folder_path><depth>max</depth></list_files>

<!-- To search file contents -->
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
5. **grep is for search** - Use \`<grep>\` to search file contents OR to find files by pattern, not \`<find_files>\`
6. **list_files for directories** - Use \`<list_files>\` to list directory contents with optional depth

## Self-Check Before Sending Response

Before outputting any tool calls, verify:
- [ ] All tool tags match the valid tools list exactly
- [ ] No invented/non-existent tool tags are used
- [ ] Tag names are lowercase with underscores
- [ ] Each tool has required parameters (file_path, folder_path, etc.)

## Error Recovery

If you realize you've used an invalid tool tag:
1. STOP immediately
2. Identify the correct valid tool from the list above
3. Rewrite using the correct tool tag
4. Double-check all other tool calls in the response

## Finding Files - Special Guidance

Since \`find_files\` does NOT exist, use these alternatives:

**To find files by name/extension:**
\`\`\`xml
<!-- Option 1: Use grep with filename pattern -->
<grep><search_term>filename-pattern</search_term><folder_path>src</folder_path></grep>

<!-- Option 2: List directory recursively -->
<list_files><folder_path>src</folder_path><depth>5</depth></list_files>
<!-- OR with unlimited depth -->
<list_files><folder_path>src</folder_path><depth>max</depth></list_files>
\`\`\`

**To search file contents:**
\`\`\`xml
<grep><search_term>search pattern</search_term><folder_path>src</folder_path></grep>
\`\`\`

Remember: \`<find_files>\` is NOT a valid tool. Use \`<grep>\` or \`<list_files>\` instead.`;
