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

<search_files><folder_path>path/to/folder</folder_path><regex>pattern</regex></search_files>

<run_command><command>your command here</command></run_command>

# RESPONSE TAGS

<markdown>prose, tables, explanations</markdown>
<code language="ts">read-only display</code>
<question><option>A</option><option>B</option></question>

Skip <markdown> when a tool call is self-explanatory.
After each read_file, STOP and wait for the file content before proceeding.`;
