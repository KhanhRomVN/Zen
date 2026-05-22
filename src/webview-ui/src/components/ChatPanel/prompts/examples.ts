export const EXAMPLES = `# REFERENCE EXAMPLES

## Ex 1: Simple Edit (2-turn)

**Turn 1** — Read then STOP:
\`\`\`xml
<read_file><file_path>calculator.py</file_path></read_file>
\`\`\`

**Turn 2** — Edit:
\`\`\`xml
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

---

## Ex 2: Multi-file Edit (batched)

**Turn 1** — Read all at once then STOP:
\`\`\`xml
<read_file><file_path>math.py</file_path></read_file>
<read_file><file_path>utils.py</file_path></read_file>
\`\`\`

**Turn 2** — Edit all at once:
\`\`\`xml
<replace_in_file><file_path>math.py</file_path><diff>...</diff></replace_in_file>
<replace_in_file><file_path>utils.py</file_path><diff>...</diff></replace_in_file>
\`\`\`

---

## Ex 3: Ambiguous Task — ASK First ✅

**User**: "Refactor the auth logic"

\`\`\`xml
<markdown>
Found auth-related files: auth/login.ts, auth/session.ts, auth/middleware.ts

To refactor accurately:
1. What's the specific goal? (e.g., extract duplication, restructure, performance)
2. Which parts need changes?
</markdown>
<list_files><folder_path>auth</folder_path></list_files>
\`\`\`

---

## Ex 4: File Not Found — ASK After 2 Searches ✅

\`\`\`xml
<!-- Turn 1 --> <search_files><folder_path>src</folder_path><regex>api.*service</regex></search_files>
<!-- Turn 2 --> <search_files><folder_path>.</folder_path><regex>ApiService|api_service</regex></search_files>
<!-- Turn 3 — STOP, ask: -->
<markdown>
Searched src/ and root with 2 patterns — no results.

1. Exact file path or filename?
2. Or should I create a new API service file?
</markdown>
\`\`\`

---

## Ex 5: Command Execution ✅

**Offer (command known, user hasn't asked):**
\`\`\`xml
<markdown>The run command is \`./gradlew desktop:run\`. Would you like me to run it now?</markdown>
<question>
  <question_title>Start game?</question_title>
  <option>Yes, run it for me</option>
  <option>No, I will run it myself</option>
</question>
\`\`\`

**Execute (user said "run it for me"):**
\`\`\`xml
<run_command><command>cd /path/to/project && chmod +x gradlew && ./gradlew desktop:run</command></run_command>
\`\`\`

**❌ WRONG — never do this:**
\`\`\`xml
<markdown>I cannot run commands on your machine. Please open terminal and type: ./gradlew desktop:run</markdown>
\`\`\`

---

## Ex 8: write_to_file — Multi-line Content ✅

**❌ WRONG — never produce one-liner content:**
\`\`\`xml
<write_to_file><file_path>src/utils.ts</file_path><content>export function add(a: number, b: number) {\n  return a + b;\n}\n</content></write_to_file>
\`\`\`

**✅ CORRECT — real newlines inside <content>:**
\`\`\`xml
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
