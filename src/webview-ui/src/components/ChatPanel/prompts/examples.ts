export const EXAMPLES = `# REFERENCE EXAMPLES

## Ex 1: Simple Edit (2-turn)

**Turn 1** — Read:
\`\`\`xml
<task_progress>
  <task_name>Add subtract to calculator.py</task_name>
  <task_file>calculator.py</task_file>
  <task>Read file</task>
  <task>Add subtract function</task>
</task_progress>
<read_file><file_path>calculator.py</file_path></read_file>
\`\`\`
← STOP

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

**Turn 1** — Read both at once:
\`\`\`xml
<read_file><file_path>math.py</file_path></read_file>
<read_file><file_path>utils.py</file_path></read_file>
\`\`\`
← STOP

**Turn 2** — Edit both at once:
\`\`\`xml
<replace_in_file><file_path>math.py</file_path><diff>...</diff></replace_in_file>
<replace_in_file><file_path>utils.py</file_path><diff>...</diff></replace_in_file>
\`\`\`

---

## Ex 3: Ambiguous Task — ASK First ✅

**User**: "Refactor the auth logic"

**Correct response:**
\`\`\`xml
<text>
I found these auth-related files: auth/login.ts, auth/session.ts, auth/middleware.ts

To refactor accurately:
1. What's the specific goal? (e.g., extract duplication, improve performance, restructure)
2. Which parts need changes? (login flow, tokens, sessions, all?)
3. Any architectural patterns to follow?
</text>
\`\`\`
← Zero tool calls. Wait for answer.

---

## Ex 4: File Not Found — ASK After 2 Searches ✅

**Turn 1:**
\`\`\`xml
<search_files><folder_path>src</folder_path><regex>api.*service</regex></search_files>
\`\`\`
← No results

**Turn 2:**
\`\`\`xml
<search_files><folder_path>.</folder_path><regex>ApiService|api_service</regex></search_files>
\`\`\`
← No results

**Turn 3** — STOP, ask:
\`\`\`xml
<text>
Searched src/ and root with patterns "api service", "ApiService" — no results found.

Could you provide:
1. Exact file path or filename?
2. Or should I create a new API service file?
</text>
\`\`\`

---

## Ex 5: New Files (no read needed)

\`\`\`xml
<task_progress>
  <task_name>React Component Library Setup</task_name>
  <task_file>src/components/Button.tsx</task_file>
  <task_file>src/components/Input.tsx</task_file>
  <task_file>src/index.ts</task_file>
  <task>Create components and barrel export</task>
</task_progress>
<write_to_file><file_path>src/components/Button.tsx</file_path><content>...</content></write_to_file>
<write_to_file><file_path>src/components/Input.tsx</file_path><content>...</content></write_to_file>
<write_to_file><file_path>src/index.ts</file_path><content>...</content></write_to_file>
\`\`\`

---

## Ex 6: Long Task — task_summary for Handoff ✅

Use \`<task_summary>\` to preserve decisions across turns:

\`\`\`xml
<task_progress>
  <task_name>Migrate Auth to JWT</task_name>
  <task_summary>Using RS256 (asymmetric) for multi-service support — not HS256</task_summary>
  <task_summary>Dual-mode: both session + JWT work simultaneously during migration</task_summary>
  <task_summary>Refresh tokens stored in tokens.refresh_tokens table (not Redis)</task_summary>
  <task_file>src/auth/jwt.service.ts</task_file>
  <task_file>src/middleware/auth.middleware.ts</task_file>
  <task_done>Implement JWT service</task_done>
  <task_done>Update middleware for dual-mode</task_done>
  <task>Write migration guide</task>
  <task>Create DB migration script</task>
</task_progress>
\`\`\`
`;
