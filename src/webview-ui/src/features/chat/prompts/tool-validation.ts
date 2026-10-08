// src/webview-ui/src/features/chat/prompts/tool-validation.ts

export const TOOL_VALIDATION = `# TOOL VALIDATION & ERROR PREVENTION

## Valid Tool Tags (CRITICAL — MUST MATCH EXACTLY)
Only these tags are valid. Full parameters and usage syntax for each are documented in the TOOLS section above — this list exists purely to catch invented tool names, not to re-document usage:
\`read_file\`, \`write_to_file\`, \`replace_in_file\`, \`list_files\`, \`find_files\`, \`grep\`, \`delete_file\`, \`run_command\`, \`git_status\`, \`git_diff\`, \`commit_message\`, \`revert_file\`, \`view_replace_history\`, \`search_skill\`, \`list_skill\`, \`read_skill\`, \`install_skill\`, \`read_memory\`, \`update_memory\`.
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

export const TOOL_VALIDATION_JSON = `# TOOL VALIDATION & ERROR PREVENTION (JSON FORMAT)

## Valid JSON Object Shapes (CRITICAL — MUST MATCH EXACTLY)
Every emitted block is a single JSON object inside its own fenced \`\`\`json block. There are exactly TWO legal shapes — a tool call and a UI object — and they are distinguished by their top-level key:

**Shape 1 — Tool call (has a \`"tool"\` key):**
\`\`\`json
{"tool":"<tool_name>","params":{ ... }}
\`\`\`
Valid \`tool\` values (full parameters in TOOLS section above):
\`read_file\`, \`write_to_file\`, \`replace_in_file\`, \`list_files\`, \`find_files\`, \`grep\`, \`delete_file\`, \`run_command\`, \`git_status\`, \`git_diff\`, \`commit_message\`, \`revert_file\`, \`view_replace_history\`, \`search_skill\`, \`list_skill\`, \`read_skill\`, \`install_skill\`, \`read_memory\`, \`update_memory\`, \`conversation_title\`.

**Shape 2 — UI/render object (has a \`"type"\` key, NO \`"tool"\` key):**
\`\`\`json
{"type":"markdown","content":"..."}
{"type":"code","language":"ts","content":"..."}
{"type":"question","questions":[ ... ]}
\`\`\`
Valid \`type\` values: \`markdown\`, \`code\`, \`question\`. These are NOT executable tools — the renderer consumes them. They replace the XML UI tags \`<markdown>\`, \`<code>\`, and \`<question>\` used in XML mode.

**Zero XML in JSON mode.** Do NOT emit \`<markdown>\`, \`<code>\`, \`<question>\`, \`<read_file>\`, or any other \`<...>\` tag anywhere in a JSON-mode response — those will not be parsed.

## Common Invented-Tool Mistakes to AVOID
These \`tool\` values do NOT exist. If you are about to emit one, STOP and use the real tool on the right instead:
\`\`\`
{"tool":"search_files"}     ❌ → use "grep" or "find_files"
{"tool":"replace_file"}     ❌ → use "replace_in_file"
{"tool":"edit_file"}        ❌ → use "replace_in_file" or "write_to_file"
{"tool":"create_file"}      ❌ → use "write_to_file"
{"tool":"update_file"}      ❌ → use "replace_in_file"
{"tool":"modify_file"}      ❌ → use "replace_in_file"
{"tool":"get_file"}         ❌ → use "read_file"
{"tool":"undo_file"}        ❌ → use "revert_file"
{"tool":"history_file"}     ❌ → use "view_replace_history"
{"tool":"markdown"}         ❌ → use {"type":"markdown","content":"..."}
{"tool":"code"}             ❌ → use {"type":"code","language":"...","content":"..."}
{"tool":"question"}         ❌ → use {"type":"question","questions":[...]}
\`\`\`
For exact syntax and parameters of every real tool, see the TOOLS section above — re-check there rather than re-deriving syntax from memory if unsure.

## JSON-Specific Mistakes to AVOID
These are the most common JSON-mode failures. Each fenced block MUST be valid, parseable JSON:
- **Unescaped newlines**: A real line break inside a string value makes the JSON invalid. Write the two characters \\n (backslash + n) instead of an actual line break. This applies to \`content\`, \`old_content\`, \`new_content\`, \`label\`, and any multi-line string.
- **Unescaped quotes**: A \`"\` inside a string value must be written as \\" . This applies especially to file contents that themselves contain string literals.
- **Unescaped backslashes**: A literal backslash in a string value must be written as \\\\ . This applies especially to regex search terms passed to \`grep\`.
- **HTML entities**: Never write \`&lt;\`, \`&gt;\`, \`&amp;\`, \`&quot;\` inside a JSON string value. Write the raw characters directly (\`<\`, \`>\`, \`&\`, \`"\`).
- **Multiple objects in one block**: Each fenced \`\`\`json block must contain EXACTLY ONE object — either one tool call OR one UI object. Do NOT put an array of calls, or two adjacent objects, in the same block. Emit a separate fenced block per object.
- **Wrong params key**: For tool calls, the parameter object is always under the key \`params\`. Do NOT use \`arguments\`, \`args\`, \`parameters\`, \`input\`, \`payload\`, or any other key name.
- **Wrong UI shape**: A UI object uses \`"type"\`, NOT \`"tool"\`. Emitting \`{"tool":"markdown",...}\` is an invented tool — use \`{"type":"markdown","content":"..."}\`.
- **XML tags anywhere**: Never emit any XML tag — tool tags (\`<read_file>\`, \`<replace_in_file>\`, …) or UI tags (\`<markdown>\`, \`<code>\`, \`<question>\`). All of them will be dropped. JSON mode is 100% JSON.
- **Missing/extra commas**: Trailing commas before \`}\` or \`]\` are invalid in strict JSON. Missing commas between fields are also invalid.
- **String value wrapping**: Numbers, booleans, and arrays belong as their JSON-native types — do not wrap them in strings unless the schema explicitly says so.

## Tool Call Validation Rules
1. NEVER invent new tool names or UI types — only use the exact names listed above.
2. Names are case-sensitive, lowercase with underscores (e.g. \`"read_file"\`, not \`"readFile"\`).
3. No abbreviations — use the full name (e.g. \`"replace_in_file"\`, not \`"replace"\`).
4. \`find_files\` vs \`grep\`: \`find_files\` locates files by name/pattern; \`grep\` searches text inside files.
5. Every fenced \`\`\`json block must parse successfully with \`JSON.parse()\` — verify before emitting.

## Self-Check Before Sending Response
Before outputting any JSON object, verify:
- [ ] Every fenced \`\`\`json block parses as valid JSON (no trailing commas; all newlines, quotes, and backslashes escaped)
- [ ] Each block contains EXACTLY ONE object, and its top-level key is either \`"tool"\` (tool call) or \`"type"\` (UI object) — never both, never neither
- [ ] Every \`tool\` value is one of the valid names listed above — none invented
- [ ] Every \`type\` value is one of \`markdown\`, \`code\`, \`question\` — none invented
- [ ] No XML tag of any kind leaked into the response
- [ ] Each tool has its required params (\`file_path\`, \`folder_path\`, \`file_name\`, etc.)
- [ ] Each \`question\` object's inner questions follow the schema (single/multi need \`options\`, text/confirm must not have \`options\`)

## Error Recovery
If you realize you've emitted an invalid JSON object:
1. STOP immediately
2. Identify the correct valid shape from the list above (tool call vs UI object)
3. Rewrite the block as a single, valid, parseable JSON object
4. Re-verify every other fenced block in the response for the same class of error
`;
