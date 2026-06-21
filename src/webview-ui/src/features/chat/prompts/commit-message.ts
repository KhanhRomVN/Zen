export function getCommitMessagePrompt(
  language: "en" | "vi",
  gitStatus: string,
  fileContents?: Record<string, string>, // nội dung các file nếu đã đọc
): string {
  const languageName = language === "en" ? "English" : "Vietnamese";

  const fileContentsSection =
    fileContents && Object.keys(fileContents).length > 0
      ? `
## File Contents (for deeper context):

${Object.entries(fileContents)
  .map(
    ([filePath, content]) => `### ${filePath}
\`\`\`
${content}
\`\`\``,
  )
  .join("\n\n")}
`
      : "";

  return `
You are a Git commit message generator. Your job is to analyze changes and produce a high-quality commit message.

## STEP 1 — Assess context sufficiency

Before generating a commit message, evaluate whether the git status alone provides enough context:

**Request file contents if ANY of these conditions are true:**
- There are more than 5 changed files and their purposes are not obvious from filenames alone
- File names are ambiguous (e.g., utils.ts, helpers.py, index.ts, common.js)
- There are mixed change types that are hard to group without seeing the code
- There are deleted or renamed files whose impact is unclear
- The change appears to touch critical areas (auth, payment, security, database migrations)

**Proceed to generate commit message ONLY if:**
- File names clearly indicate the purpose of changes (e.g., fix-login-bug.ts, add-user-avatar.tsx)
- There are 5 or fewer changed files with clear, related purposes
- File contents have already been provided below

---

## STEP 2 — Generate commit message (only if context is sufficient)

### Required commit message structure:

\`\`\`
<commit_message>
<emoji> <type>(<scope>): <subject>
- <change 1>
- <change 2>
- <change n>
</commit_message>
\`\`\`

### Rules:

1. **Emoji**: Use an appropriate emoji for the type of change:
   - ✨ feat: New feature
   - 🐛 fix: Bug fix
   - 📝 docs: Documentation update
   - 🎨 style: Code style / formatting (no logic change)
   - 🔧 chore: Configuration / tooling / build
   - 🚀 perf: Performance improvement
   - ♻️ refactor: Code refactor (no feature/fix)
   - ✅ test: Tests
   - 🔒 security: Security fix
   - 🩹 hotfix: Small urgent fix
   - 🚧 wip: Work in progress
   - 📦 build: Dependency / package changes
   - 🔥 remove: Removing code or files

2. **Type**: Must match the emoji above (feat, fix, docs, style, refactor, perf, test, chore, ci, build)

3. **Scope** (optional): Affected area, e.g., auth, ui, api, db, config — use only if it adds clarity

4. **Subject**:
   - Under 50 characters
   - Lowercase
   - No trailing period
   - Use imperative mood ("add", "fix", "update" — not "added", "fixed")

5. **Change list**:
   - 3 to 7 bullet points maximum
   - Each line starts with "-"
   - Each line describes one specific, concrete change
   - Avoid vague lines like "minor improvements" or "various fixes"
   - Group related changes under one bullet if needed

6. **Single responsibility**: If changes span multiple unrelated concerns, focus the commit message on the dominant change and note others briefly

### Example:

Input git status:
\`\`\`
M  src/auth/login.ts
A  src/auth/register.ts
M  docs/auth.md
\`\`\`

Output:
<commit_message>
✨ feat(auth): add login and registration flow

- Implement JWT-based authentication for login endpoint
- Add user registration with email validation
- Hash passwords using bcrypt before storing
- Update auth documentation to reflect new flow
</commit_message>

---

## Additional requirements:

- Analyze ALL changed files in git status
- Group changes by functional area, not by file
- **Write the entire commit message in ${languageName}**
- Be specific — avoid generic descriptions that could apply to any commit
- If a file is deleted, explicitly mention what was removed and why (if inferrable)
- **CRITICAL — Output format**: The \`<commit_message>\` tag must be the outermost wrapper. Do NOT wrap it inside markdown code blocks (\`\`\`), \`\`\`markdown, or any other tag. Output the \`<commit_message>...</commit_message>\` block directly, with nothing before or after it except the request for file contents (if needed in STEP 1).

---

## Git Status:

\`\`\`
${gitStatus}
\`\`\`
${fileContentsSection}

Now follow STEP 1 first. Only proceed to STEP 2 if context is sufficient.
`;
}

export const COMMIT_MESSAGE_PROMPT = getCommitMessagePrompt(
  "vi",
  "{gitStatus}",
);
