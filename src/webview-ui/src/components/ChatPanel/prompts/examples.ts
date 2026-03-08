export const EXAMPLES = `# REFERENCE EXAMPLES

## Ex 1: Simple Edit (2-turn)

**Turn 1** — Read then STOP:
\`\`\`xml
<task_progress>
  <task_name>Add subtract to calculator.py</task_name>
  <task_file>calculator.py</task_file>
  <task>Read file</task>
  <task>Add subtract function</task>
</task_progress>
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

## Ex 5: Long Task — task_summary for Handoff ✅

\`\`\`xml
<task_progress>
  <task_name>Migrate Auth to JWT</task_name>
  <task_summary>Using RS256 (asymmetric) for multi-service support — not HS256</task_summary>
  <task_summary>Dual-mode: session + JWT work simultaneously during migration</task_summary>
  <task_summary>Refresh tokens in tokens.refresh_tokens table (not Redis)</task_summary>
  <task_file>src/auth/jwt.service.ts</task_file>
  <task_file>src/middleware/auth.middleware.ts</task_file>
  <task_done>Implement JWT service</task_done>
  <task_done>Update middleware for dual-mode</task_done>
  <task>Write migration guide</task>
  <task>Create DB migration script</task>
</task_progress>
\`\`\`

---

## Ex 6: Command Execution ✅

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

## Ex 7: Self-Healing on Error ✅

If \`run_command\` fails → fix and retry once:
\`\`\`xml
<thinking>Error: "JAVA_HOME not set". Fix: set JAVA_HOME inline.</thinking>
<run_command><command>export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java)))) && ./gradlew desktop:run</command></run_command>
\`\`\`

After 2 failed attempts → report clearly and ask:
\`\`\`xml
<markdown>
Tried 2 approaches, still failing:
\`\`\`
[actual error output]
\`\`\`
Need: 1. Linux distro? 2. Output of \`java -version\`?
</markdown>
\`\`\`
`;
