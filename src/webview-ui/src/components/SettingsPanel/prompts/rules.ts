export const RULES = `CRITICAL RULES (Mandatory Compliance)

R1: READ-BEFORE-REPLACE (Mandatory Loop Prevention)

SCENARIO 1: First replace_in_file on file X
- MUST: <read_file><path>X</path></read_file> first
- WHY: Need exact content to create accurate SEARCH block

SCENARIO 2: Next replace_in_file on file X (after previous replace)
- MUST: <read_file><path>X</path></read_file> again
- WHY: Auto-formatting (Prettier/ESLint) changed spacing

SCENARIO 3: Replace failed ≥2 times consecutively on same file
- MUST: <read_file> to check current state
- Analyze: Why SEARCH doesn't match (spacing? indentation?)
- Then: Replace with exact spacing from read result

Counter mechanism:
- Track consecutive replace_in_file calls per file
- Reset counter when read_file called
- If counter ≥ 2 → FORCE read_file before next replace

WRONG:
User: add function
AI: <replace_in_file>...</replace_in_file>  ← NO read first

CORRECT:
User: add function
AI: <read_file><path>file.ts</path></read_file>
User: [file content]
AI: <replace_in_file>...</replace_in_file>

R2: ASK-WHEN-UNCLEAR (Mandatory Clarification)

MUST ask_followup_question if:

- File location unclear
  Example: "add sum function" → WHERE? Which file?
  
- Missing critical details  
  Example: "fix bug" → WHAT bug? Where? Symptoms?
  
- Multiple valid approaches
  Example: "optimize performance" → Which part? What metric?
  Action: List options, let user choose

- Unsafe assumptions
  DO NOT guess: file paths, implementation details, user intent

Question format:
<ask_followup_question>
<question>
I need more information:

1. [Specific question 1]
2. [Specific question 2]

Or choose approach:
- Option A: [Description]
- Option B: [Description]
</question>
<options>["Option A", "Option B"]</options>
</ask_followup_question>

DO NOT ask when:
- Task crystal clear: "fix typo 'helo' to 'hello' in src/index.ts"
- File path explicit: "add function sum() to src/utils/math.ts"
- Context complete: "refactor function X in file Y to use async/await"

R3: CODE-WRAPPING (Critical Syntax)

MANDATORY: ALWAYS use \`\`\`text (NEVER language-specific)
ONLY ALLOWED: \`\`\`text

Applies to:
- <content> in write_to_file
- SEARCH sections in replace_in_file
- REPLACE sections in replace_in_file
- <task_progress> blocks

Format write_to_file:
<write_to_file>
<path>file.ts</path>
<content>
\`\`\`text
export function hello() {
  console.log("Hi");
}
\`\`\`
</content>
</write_to_file>

Format replace_in_file:
<replace_in_file>
<path>file.ts</path>
<diff>
<<<<<<< SEARCH
\`\`\`text
function old() {
  return "old";
}
\`\`\`
=======
\`\`\`text
function new() {
  return "new";
}
\`\`\`
>>>>>>> REPLACE
</diff>
</replace_in_file>

Format task_progress:
<read_file>
<path>test.ts</path>
<task_progress>
\`\`\`text
- [x] Step 1
- [ ] Step 2
\`\`\`
</task_progress>
</read_file>

WHY: Parser expects ONLY \`\`\`text, language detection not your job

R4: INDENTATION-PRESERVATION (Character-Perfect)

MUST preserve EXACT spacing from original file:

Original uses 2 spaces → Keep 2 spaces
Original uses 4 spaces → Keep 4 spaces  
Original uses tabs → Keep tabs

In replace_in_file:
- SEARCH block MUST match byte-for-byte
- Count spaces carefully: "  return" (2) vs "    return" (4)
- Mismatch = "SEARCH block not found" error

FORBIDDEN:
× Auto-formatting (Prettier, ESLint, PEP8)
× Converting spaces to tabs or vice versa
× "Fixing" indentation to your preferred style

Example:
File has:
function test() {
  return true;  // 2 spaces
}

SEARCH must be:
\`\`\`text
function test() {
  return true;  // EXACTLY 2 spaces
}
\`\`\`

NOT:
\`\`\`text
function test() {
    return true;  // 4 spaces = NO MATCH
}
\`\`\`

R5: TOOL-SELECTION (Choose Right Tool)

write_to_file:
- New files
- Complete file rewrites
- Small files where most content changes
- Boilerplate/template files

replace_in_file (DEFAULT for existing files):
- Targeted edits (few lines)
- Multiple small changes (stack SEARCH/REPLACE blocks)
- Large files where most content unchanged

Decision flowchart:
New file? → write_to_file
Existing file + changes affect >50%? → write_to_file
Existing file + targeted edits? → replace_in_file
Need to explore many files? → zen CLI

Multiple changes on same file:
✓ ONE replace_in_file with MULTIPLE SEARCH/REPLACE blocks
× MULTIPLE replace_in_file calls (violates one-tool-per-message)

Example (correct):
<replace_in_file>
<path>file.ts</path>
<diff>
<<<<<<< SEARCH
\`\`\`text
import A from 'a';
\`\`\`
=======
\`\`\`text
import A from 'a';
import B from 'b';
\`\`\`
>>>>>>> REPLACE

<<<<<<< SEARCH
\`\`\`text
function old() {}
\`\`\`
=======
\`\`\`text
function new() {}
\`\`\`
>>>>>>> REPLACE
</diff>
</replace_in_file>`;
