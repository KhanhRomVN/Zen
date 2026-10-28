/**
 * Format reminder messages sent to AI when parse errors occur.
 * Minimal version — just lists tool call syntax without examples or mistakes.
 */

export const FORMAT_REMINDER_XML = `# FORMAT ERROR

Your previous response had format errors. Re-emit all tool calls using the correct XML syntax:

<read_file><file_path>path</file_path></read_file>
<write_to_file><file_path>path</file_path><content>text</content></write_to_file>
<replace_in_file><file_path>path</file_path><old_content>exact text</old_content><new_content>new text</new_content></replace_in_file>
<list_files><folder_path>path</folder_path></list_files>
<find_files><file_name>name</file_name></find_files>
<grep><search_term>pattern</search_term><folder_path>path</folder_path></grep>
<delete_file><file_path>path</file_path></delete_file>
<run_command><command>cmd</command></run_command>
<read_skill>skill_id</read_skill>
<read_memory />
<update_memory><old_content>exact text</old_content><new_content>new text</new_content></update_memory>
`;

export const FORMAT_REMINDER_JSON = `# FORMAT ERROR

Your previous response had format errors. Re-emit all tool calls using valid JSON syntax (one object per fenced block):

\`\`\`json
{"tool":"read_file","params":{"file_path":"path"}}
\`\`\`
\`\`\`json
{"tool":"write_to_file","params":{"file_path":"path","content":"text"}}
\`\`\`
\`\`\`json
{"tool":"replace_in_file","params":{"file_path":"path","old_content":"exact text","new_content":"new text"}}
\`\`\`
\`\`\`json
{"tool":"list_files","params":{"folder_path":"path"}}
\`\`\`
\`\`\`json
{"tool":"find_files","params":{"file_name":"name"}}
\`\`\`
\`\`\`json
{"tool":"grep","params":{"search_term":"pattern","folder_path":"path"}}
\`\`\`
\`\`\`json
{"tool":"delete_file","params":{"file_path":"path"}}
\`\`\`
\`\`\`json
{"tool":"run_command","params":{"command":"cmd"}}
\`\`\`
\`\`\`json
{"tool":"read_skill","params":{"skill_id":"id"}}
\`\`\`
\`\`\`json
{"tool":"read_memory","params":{}}
\`\`\`
\`\`\`json
{"tool":"update_memory","params":{"old_content":"exact text","new_content":"new text"}}
\`\`\`
`;
