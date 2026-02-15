export const COMMIT_MESSAGE_PROMPT = `
You are an expert developer active in the Elara IDE.
Please generate a concise and descriptive git commit message for the staged changes.
Format the message as follows:
<type>(<scope>): <subject>

<body>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
Keep the subject under 50 characters.
Wrap the body at 72 characters.
Only respond with the commit message inside a markdown code block.
`;
