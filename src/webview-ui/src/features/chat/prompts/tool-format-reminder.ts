const TOOL_FORMAT_REMINDER_JSON = `# TOOL CALL FORMAT (JSON, each call is one object in its own json code fence)
{"tool":"read_file","params":{"file_path":"p","start_line":1,"end_line":50}}
{"tool":"write_to_file","params":{"file_path":"p","content":"c"}}
{"tool":"replace_in_file","params":{"file_path":"p","old_content":"o","new_content":"n"}}
{"tool":"view_replace_history","params":{"file_path":"p"}}
{"tool":"revert_file","params":{"file_path":"p","version":3}}
{"tool":"list_files","params":{"folder_path":"p","depth":2}}
{"tool":"find_files","params":{"file_name":"f","folder_path":"p"}}
{"tool":"grep","params":{"search_term":"s","file_path":"p"}}
{"tool":"delete_file","params":{"file_path":"p"}}
{"tool":"run_command","params":{"command":"c","folder_path":"p"}}
{"tool":"read_skill","params":{"skill_id":"id"}}
{"tool":"read_memory","params":{}}
{"tool":"update_memory","params":{"old_content":"o","new_content":"n"}}
{"tool":"conversation_title","params":{"title":"t"}}`;

const TOOL_FORMAT_REMINDER_XML = `# TOOL CALL FORMAT (XML)
<read_file><file_path>p</file_path><start_line>1</start_line><end_line>50</end_line></read_file>
<write_to_file><file_path>p</file_path><content>c</content></write_to_file>
<replace_in_file><file_path>p</file_path><old_content>o</old_content><new_content>n</new_content></replace_in_file>
<view_replace_history><file_path>p</file_path></view_replace_history>
<revert_file><file_path>p</file_path><version>3</version></revert_file>
<list_files><folder_path>p</folder_path><depth>2</depth></list_files>
<find_files><file_name>f</file_name><folder_path>p</folder_path></find_files>
<grep><search_term>s</search_term><file_path>p</file_path></grep>
<delete_file><file_path>p</file_path></delete_file>
<run_command><command>c</command><folder_path>p</folder_path></run_command>
<read_skill>id</read_skill>
<read_memory />
<update_memory><old_content>o</old_content><new_content>n</new_content></update_memory>
<conversation_title>t</conversation_title>`;

export const buildToolFormatReminder = (toolFormat: "xml" | "json"): string =>
  toolFormat === "json" ? TOOL_FORMAT_REMINDER_JSON : TOOL_FORMAT_REMINDER_XML;