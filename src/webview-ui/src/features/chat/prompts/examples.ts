export const EXAMPLES = `# REFERENCE EXAMPLES

## Ex 1: Simple Edit (3-turn)

**Turn 1** — Read then STOP:
\`\`\`xml
<thinking>
Pass 1 (Plan): The user wants to add a subtract function. I need to examine calculator.py first to see the existing structure.
Assumptions: None — I will read the file before deciding anything.
Pass 2 (Verify): I must not assume the content of calculator.py or do any editing yet. I will only call read_file and STOP. No markdown in tool turns.
</thinking>
<read_file><file_path>calculator.py</file_path></read_file>
\`\`\`

**Turn 2** — Edit and STOP:
\`\`\`xml
<thinking>
Pass 1 (Plan): The file calculator.py is read. It has an add function. I will append the subtract function.
Pass 2 (Verify): I will write the search-replace block exactly. Since this is a tool turn, I MUST NOT output any <markdown> block. I will wait for the tool output to confirm success.
</thinking>
<replace_in_file>
<file_path>calculator.py</file_path>
<diff>
<<<<<<< SEARCH
def add(a, b):
    return a + b
=======
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
>>>>>>> REPLACE
</diff>
</replace_in_file>
\`\`\`

**Turn 3** — Final Summary (Tool results returned successfully):
\`\`\`xml
<thinking>
Pass 1 (Plan): The replace_in_file tool succeeded. The task is fully completed.
Pass 2 (Verify): Since no more tools are being called, I can now output the final markdown summary.
</thinking>
<markdown>
Đã thêm hàm \`subtract\` vào file \`calculator.py\`. Hàm này thực hiện trừ hai số \`a\` và \`b\`.
</markdown>
\`\`\`

---

## Ex 2: Multi-file Edit (3-turn batched)

**Turn 1** — Read all at once then STOP:
\`\`\`xml
<thinking>
Pass 1 (Plan): Need to update configuration structure in math.py and utils.py. I must read both files first.
Pass 2 (Verify): No faking output, no editing yet. Batching read_file calls and STOP. No markdown.
</thinking>
<read_file><file_path>math.py</file_path></read_file>
<read_file><file_path>utils.py</file_path></read_file>
\`\`\`

**Turn 2** — Edit all at once:
\`\`\`xml
<thinking>
Pass 1 (Plan): Both files have been read. I will write replacements for both files.
Pass 2 (Verify): Batching replacements. Since this message contains tool calls, I must not output any <markdown> block yet.
</thinking>
<replace_in_file><file_path>math.py</file_path><diff>...</diff></replace_in_file>
<replace_in_file><file_path>utils.py</file_path><diff>...</diff></replace_in_file>
\`\`\`

**Turn 3** — Final Summary:
\`\`\`xml
<thinking>
Pass 1 (Plan): Both replacements were successfully applied. The task is complete.
Pass 2 (Verify): No tools needed. Output the final summary.
</thinking>
<markdown>
Đã cập nhật cấu trúc cấu hình ở cả \`math.py\` và \`utils.py\`.
</markdown>
\`\`\`

---

## Ex 3: Ambiguous Task — Explore then Ask ✅

**User**: "Refactor the auth logic"

**Turn 1** — Explore files:
\`\`\`xml
<thinking>
Pass 1 (Plan): The request is too vague. I need to see what auth-related files exist in the project first to ask a precise question.
Pass 2 (Verify): I will run list_files for the auth folder and STOP. Do not output markdown.
</thinking>
<list_files><folder_path>auth</folder_path></list_files>
\`\`\`

**Turn 2** — CLARIFY step: findings reveal multiple files, ask structured question:
\`\`\`xml
<thinking>
Pass 1 (Plan): The file listing returned: auth/login.ts, auth/session.ts, auth/middleware.ts. I found 3 files. "Refactor" is ambiguous — it could mean: extract duplication, restructure, or improve performance. I must not assume which. ASSUMPTION-BAN applies.
Pass 2 (Verify): No tools running. I must ask a multi-question to resolve all ambiguities before proceeding.
</thinking>
<markdown>
Found auth-related files: \`auth/login.ts\`, \`auth/session.ts\`, \`auth/middleware.ts\`
</markdown>
<question>
  <q id="1" type="single" label="What is the goal of the refactor?">
    <option>Extract duplicated logic into shared helpers</option>
    <option>Restructure the module layout / file organization</option>
    <option>Improve performance (reduce re-renders, optimize queries)</option>
    <option>Something else — I will describe in the next message</option>
  </q>
  <q id="2" type="multi" label="Which files should be included in the refactor?">
    <option>auth/login.ts</option>
    <option>auth/session.ts</option>
    <option>auth/middleware.ts</option>
    <option>All of the above</option>
  </q>
  <q id="3" type="confirm" label="Should I preserve existing function signatures (no breaking changes)?" />
</question>
\`\`\`

---

## Ex 4: File Not Found — Search then Ask ✅

**Turn 1** — Search 1:
\`\`\`xml
<thinking>
Pass 1 (Plan): User wants to check ApiService. I will search for it first.
Pass 2 (Verify): Do not fake results. Just run search_files and STOP. No markdown.
</thinking>
<search_files><folder_path>src</folder_path><regex>api.*service</regex></search_files>
\`\`\`

**Turn 2** — Search 2:
\`\`\`xml
<thinking>
Pass 1 (Plan): First search failed. I will try a second search at root with a broader pattern.
Pass 2 (Verify): Run search_files and STOP. No markdown.
</thinking>
<search_files><folder_path>.</folder_path><regex>ApiService|api_service</regex></search_files>
\`\`\`

**Turn 3** — Ask:
\`\`\`xml
<thinking>
Pass 1 (Plan): Two searches failed. I must ask the user for clarification.
Pass 2 (Verify): No tools running. Output markdown and question.
</thinking>
<markdown>
Searched \`src/\` and root with 2 patterns — no results found.
</markdown>
<question>
  <q id="1" type="single" label="How should I proceed?">
    <option>I will provide the exact file path</option>
    <option>Create a new API service file from scratch</option>
    <option>The file might be in a different directory — let me check</option>
  </q>
  <q id="2" type="text" label="If you know the exact path or filename, enter it here:" />
</question>
\`\`\`

---

## Ex 5: Command Execution ✅

**Turn 1** — Offer (No tool run yet, just offer):
\`\`\`xml
<thinking>
Pass 1 (Plan): I know the run command. I will offer it to the user via a question.
Pass 2 (Verify): No tool is executed in this turn. I will output markdown and the question block.
</thinking>
<markdown>The run command is \`./gradlew desktop:run\`.</markdown>
<question>
  <q id="1" type="confirm" label="Would you like me to run it now?" />
</question>
\`\`\`

**Turn 2** — Execute (user confirmed Yes):
\`\`\`xml
<thinking>
Pass 1 (Plan): User approved command execution. I will run the command.
Pass 2 (Verify): Run the command and STOP. Do not output markdown yet.
</thinking>
<run_command><command>cd /path/to/project && chmod +x gradlew && ./gradlew desktop:run</command></run_command>
\`\`\`

**Turn 3** — Complete:
\`\`\`xml
<thinking>
Pass 1 (Plan): The run command finished executing successfully.
Pass 2 (Verify): Output markdown to confirm completion.
</thinking>
<markdown>
Lệnh \`./gradlew desktop:run\` đã được chạy thành công.
</markdown>
\`\`\`

---

## Ex 6: write_to_file — Multi-line Content ✅

\`\`\`xml
<thinking>
Pass 1 (Plan): Creating utility file with helper function.
Pass 2 (Verify): Write with proper indentation and real newlines. No markdown in this tool turn.
</thinking>
<write_to_file>
<file_path>src/utils.ts</file_path>
<content>
export function add(a: number, b: number) {
  return a + b;
}
</content>
</write_to_file>
\`\`\`

---

## Ex 7: MID-TASK-CLARIFY — Read reveals contradiction ✅

**User**: "Add input validation to the createUser function in user.service.ts"

**Turn 1** — Read:
\`\`\`xml
<thinking>
Pass 1 (Plan): Read user.service.ts to find createUser.
Pass 2 (Verify): READ-FOR-EDIT intent. STOP after read, no predictions.
</thinking>
<read_file><file_path>src/user.service.ts</file_path></read_file>
\`\`\`

**Turn 2** — READ result reveals: createUser calls an external validation library already. MID-TASK-CLARIFY:
\`\`\`xml
<thinking>
Pass 1 (Plan): The file was read. I see that createUser already calls \`validateWithZod(schema, data)\` from an external library. This contradicts the assumption that no validation exists. ASSUMPTION-BAN + MID-TASK-CLARIFY apply. I must NOT silently add another validation layer.
Pass 2 (Verify): No tools. Output markdown explaining the finding and ask a structured question.
</thinking>
<markdown>
After reading \`user.service.ts\`, I found that \`createUser\` already uses \`validateWithZod(schema, data)\` for validation (line 42).
</markdown>
<question>
  <q id="1" type="single" label="The function already has Zod validation. What should I do?">
    <option>Extend the existing Zod schema with new rules</option>
    <option>Add a separate manual validation layer before Zod runs</option>
    <option>Replace Zod with a custom validation implementation</option>
    <option>The existing validation is not sufficient — let me explain what is missing</option>
  </q>
  <q id="2" type="text" label="If you want to add specific rules, describe them here:" />
</question>
\`\`\`

---

## Ex 8: IMPACT-CONFIRM — Large scope change ✅

**User**: "Rename UserService to AccountService everywhere"

**Turn 1** — Explore scope:
\`\`\`xml
<thinking>
Pass 1 (Plan): Need to find all files that reference UserService before making any changes.
Pass 2 (Verify): EXPLORE phase. No edits yet. STOP after search.
</thinking>
<search_files><folder_path>src</folder_path><regex>UserService</regex></search_files>
\`\`\`

**Turn 2** — IMPACT-CONFIRM before executing:
\`\`\`xml
<thinking>
Pass 1 (Plan): Search returned 6 files: user.service.ts, user.controller.ts, user.module.ts, auth.module.ts, app.module.ts, user.service.spec.ts. This is >2 files, so IMPACT-CONFIRM is mandatory before any edits.
Pass 2 (Verify): No tools. Present the scope and ask for confirmation via multi-question.
</thinking>
<markdown>
Found **6 files** that reference \`UserService\`:
- \`src/user.service.ts\` — the service itself (will be renamed)
- \`src/user.controller.ts\` — injects UserService
- \`src/user.module.ts\` — declares UserService
- \`src/auth.module.ts\` — imports UserService
- \`src/app.module.ts\` — imports UserService
- \`src/user.service.spec.ts\` — test file
</markdown>
<question>
  <q id="1" type="confirm" label="Proceed with renaming UserService → AccountService across all 6 files?" />
  <q id="2" type="single" label="Should the file user.service.ts also be renamed on disk?">
    <option>Yes, rename the file to account.service.ts</option>
    <option>No, keep the filename as user.service.ts</option>
  </q>
  <q id="3" type="confirm" label="Should I also update the test file (user.service.spec.ts)?" />
</question>
\`\`\`

---

## Ex 9: RE-CLARIFY — 3 consecutive tool turns ✅

*(After 3 tool-call turns have passed with no user message)*

\`\`\`xml
<thinking>
Pass 1 (Plan): I have completed 3 tool turns: read auth.ts, read session.ts, replaced auth.ts. No user message in between. RE-CLARIFY constraint applies.
Pass 2 (Verify): Pause and re-confirm direction with the user before continuing.
</thinking>
<markdown>
**Progress check** — I have completed 3 steps so far:
1. ✅ Read \`auth/auth.ts\`
2. ✅ Read \`auth/session.ts\`
3. ✅ Updated \`auth/auth.ts\` — extracted token validation into a shared helper
</markdown>
<question>
  <q id="1" type="single" label="Next step is to apply the same extraction to session.ts. Should I continue?">
    <option>Yes, continue with session.ts</option>
    <option>Show me the change to auth.ts first before continuing</option>
    <option>Stop here — the goal has changed</option>
  </q>
</question>
\`\`\`
`;
