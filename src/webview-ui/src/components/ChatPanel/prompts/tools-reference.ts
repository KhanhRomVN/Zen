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

<search_content><folder_path>path/to/folder</folder_path><pattern>text or regex to search</pattern></search_content>

<run_command><command>your command here</command></run_command>

<get_outline><file_path>path/to/file</file_path></get_outline>

<get_definition><symbol>symbol_name</symbol><file_path>path/to/file</file_path></get_definition>

<get_references><symbol>symbol_name</symbol><file_path>path/to/file</file_path></get_references>

# RESPONSE TAGS

<thinking>your private two-pass reasoning and planning</thinking>
<markdown>prose, tables, explanations</markdown>
<code language="ts">read-only display</code>
<question><option>A</option><option>B</option></question>

Never output a <markdown> block in the same message with tool calls. Wait for tool results in the next turn before writing any markdown.
After each read_file, STOP and wait for the file content before proceeding.`;
