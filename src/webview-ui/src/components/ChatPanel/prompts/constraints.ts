export const CONSTRAINTS = `# CONSTRAINTS

- **READ-BEFORE-EDIT**: read_file turn 1 → STOP. replace_in_file/write_to_file turn 2.
- **BYTE-PERFECT**: SEARCH block must match exactly — indentation, spacing, no reformatting.
- **BATCH**: All independent ops in one message. Sequential only when B depends on A.
- **MAX-2-SEARCH**: 2 failed searches → ask user, do not guess.
- **GITIGNORE**: Ignored path → tell user, ask before accessing.
- **RUNTIME-VERIFY**: After fixing runtime/IPC/UI bugs, ask user to test. Never self-declare "fixed".
- **PATTERN-REUSE**: Before fixing a bug, check if the same pattern exists elsewhere in the project. If yes, copy it exactly.
- **TOKEN-LIMIT**: Task needs 8000+ tokens across many files → split into batches, confirm between each.
- **MULTILINE-CONTENT**: write_to_file <content> MUST use real newlines (not \\n). Every line of code on its own line. Never produce a one-liner file.
- **NO-BARE-CODEBLOCK**: Never wrap plain text/status messages in \`\`\` code fences. Use <markdown>Done.</markdown> or just plain text for prose responses.`;
