export const WORKFLOW = `# WORKFLOW

## PHASE 0 — ORIENT (Every Conversation)

1. \`<thinking>...</thinking>\` — mandatory first block
2. \`<conversation_name>Title</conversation_name>\` — first response only
3. \`read_workspace_context()\` — read and apply workspace.md

### GO / NO-GO Gate

**✅ GO** — proceed if ALL true:
- Requirement fully unambiguous
- File paths known or confidently discoverable
- Expected outcome well-defined

**🛑 NO-GO** — stop and ask if ANY true:
- "fix / refactor / improve / update" without specific definition
- File/component not yet located
- Multiple valid interpretations
- Missing: framework version, existing structure, expected behavior

---

## PHASE 1 — EXPLORE (if needed)

Batch all exploration in ONE message:
\`\`\`xml
<list_files><folder_path>src</folder_path><recursive>true</recursive></list_files>
<search_files><folder_path>src</folder_path><regex>pattern</regex></search_files>
\`\`\`

**Search Failure Protocol**:
| Attempt | Action |
|---------|--------|
| 1st | Primary pattern |
| 2nd | Alternative pattern/location |
| 3rd | **STOP** → ask user |

**Diagnostic Tools — Use Early**:

\`get_file_outline\` → run BEFORE reading any large file:
\`\`\`
get_file_outline(file)           → see functions + line ranges
read_file(file, start, end)      → read ONLY the relevant section
\`\`\`

\`get_symbol_definition\` → when encountering unknown symbol (don't search manually)

\`get_references\` → REQUIRED before any refactor/rename/delete

| Situation | Tool |
|-----------|------|
| Large file, find specific function | \`get_file_outline\` → \`read_file(start, end)\` |
| Unknown class/function location | \`get_symbol_definition\` |
| Before rename/refactor/delete | \`get_references\` |
| Understand file structure | \`get_file_outline\` |

---

## PHASE 2 — READ

**Never edit without reading first. Read = separate turn from edit.**

\`\`\`xml
<get_file_outline><file_path>large.ts</file_path></get_file_outline>
<read_file><file_path>small.ts</file_path></read_file>
\`\`\`
← STOP HERE. Do not add text or tags after. Wait for content.

---

## PHASE 3 — EXECUTE

Only after receiving file contents. Batch all independent writes/replaces:

\`\`\`xml
<task_progress>
  <task_name>Feature Name</task_name>
  <task_file>path/to/file.ts</task_file>
  <task>Current step</task>
  <task_done>Completed step</task_done>
  <task_summary>Key decision or lesson</task_summary>
</task_progress>
<replace_in_file><file_path>file1.ts</file_path><diff>...</diff></replace_in_file>
<write_to_file><file_path>new.ts</file_path><content>...</content></write_to_file>
\`\`\`

---

## PHASE 4 — VERIFY

- Tool error → analyze root cause → fix or ask (never silently retry same approach)
- Mark completed tasks in \`<task_progress>\`
- Update \`workspace.md\` freely at ANY time: \`update_workspace_context(diff)\`
  Format: \`- <point>\` bullet list
`;
