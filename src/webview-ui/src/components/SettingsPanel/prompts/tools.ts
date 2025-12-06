export const TOOLS = `TOOLS REFERENCE (Compressed Format)

FILE OPERATIONS

read_file(path)
- Read file content (text, PDF, DOCX)
- MUST use before any replace_in_file
- Usage: <read_file><path>file.ts</path></read_file>

write_to_file(path, content)
- Create new or overwrite ENTIRE file
- Use for: new files, complete rewrites, small files
- MUST wrap content in \`\`\`text block
- Structure: <write_to_file><path>...</path>
             <content>\`\`\`text
             CODE
             \`\`\`</content></write_to_file>

replace_in_file(path, diff)
- Targeted edits (DEFAULT for existing files)
- Use SEARCH/REPLACE blocks
- MUST read_file first (see C2)
- Format: <<<<<<< SEARCH
          \`\`\`text
          OLD_CODE (exact match)
          \`\`\`
          =======
          \`\`\`text
          NEW_CODE
          \`\`\`
          >>>>>>> REPLACE
- Rules: 
  * SEARCH must match EXACTLY (spacing, indentation)
  * Each SEARCH/REPLACE block replaces 1 occurrence
  * List blocks in file order
  * Keep blocks concise (only changed lines + context)

list_files(path, recursive?)
- List directory contents
- recursive=true: recursive, false: top-level only
- Usage: <list_files><path>.</path><recursive>true</recursive></list_files>

search_files(path, regex, file_pattern?)
- Regex search with context
- file_pattern: glob filter (*.ts, *.py)
- Usage: <search_files><path>src</path><regex>pattern</regex></search_files>

list_code_definition_names(path)
- List classes/functions/methods in directory
- Useful for codebase structure overview

EXECUTION

execute_command(command, requires_approval)
- Run CLI command in CWD
- requires_approval: true for destructive ops (delete, install, config changes)
- requires_approval: false for safe ops (read, build, run servers)
- Supports command chaining: cd dir && npm install
- Usage: <execute_command>
         <command>npm run dev</command>
         <requires_approval>false</requires_approval>
         </execute_command>

COMMUNICATION

ask_followup_question(question, options?)
- Ask user when CRITICAL info missing
- options: array of 2-5 choices (optional)
- DO NOT ask about optional parameters
- Usage: <ask_followup_question>
         <question>Which file to add to?</question>
         <options>["utils/math.ts", "Create new file"]</options>
         </ask_followup_question>

attempt_completion(result, command?)
- Present final result (ONLY after user confirms success)
- command: demo command (open index.html, open localhost:3000)
- DO NOT end with questions
- Usage: <attempt_completion>
         <result>Completed task X. Details: ...</result>
         <command>open index.html</command>
         </attempt_completion>

TASK PROGRESS (Optional Parameter)

Can add to ANY tool:
<task_progress>
\`\`\`text
- [x] Completed step
- [ ] Current step
- [ ] Future step
\`\`\`
</task_progress>

Rules:
- MUST wrap in \`\`\`text block
- Update silently (no announcement)
- Keep focused (meaningful milestones, not minor details)
- Rewrite if scope changes`;
