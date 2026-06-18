export const EXAMPLES = `# REFERENCE EXAMPLES

## Ex 1: Simple Edit (3-turn)

**Turn 1** — Read then STOP:
\`\`\`xml
<thinking>
Pass 1 (Plan): The user wants to add a subtract function. I need to examine calculator.py first to see the existing structure.
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

**Turn 2** — Ask clarifying question using the results:
\`\`\`xml
<thinking>
Pass 1 (Plan): The file listing returned: auth/login.ts, auth/session.ts, auth/middleware.ts. I can now ask a focused clarifying question.
Pass 2 (Verify): I am not running any tools in this turn, so I can output a <markdown> block to communicate with the user.
</thinking>
<markdown>
Found auth-related files: auth/login.ts, auth/session.ts, auth/middleware.ts

To refactor accurately:
1. What's the specific goal? (e.g., extract duplication, restructure, performance)
2. Which parts need changes?
</markdown>
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
Pass 2 (Verify): No tools running. Output markdown asking the user.
</thinking>
<markdown>
Searched src/ and root with 2 patterns — no results.

1. Exact file path or filename?
2. Or should I create a new API service file?
</markdown>
\`\`\`

---

## Ex 5: Command Execution ✅

**Turn 1** — Offer (No tool run yet, just offer):
\`\`\`xml
<thinking>
Pass 1 (Plan): I know the run command. I will offer it to the user via a question.
Pass 2 (Verify): No tool is executed in this turn. I will output markdown and the question block.
</thinking>
<markdown>The run command is \`./gradlew desktop:run\`. Would you like me to run it now?</markdown>
<question>
  <question_title>Start game?</question_title>
  <option>Yes, run it for me</option>
  <option>No, I will run it myself</option>
</question>
\`\`\`

**Turn 2** — Execute (user said "run it for me"):
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
`;
