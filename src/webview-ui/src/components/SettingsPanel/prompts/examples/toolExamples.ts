export const TOOL_EXAMPLES = `====

USING THE CLINE CLI TOOL

The Zen CLI tool can be used to assign Zen AI agents with focused tasks. This can be used to keep you focused by delegating information-gathering and exploration to separate Zen instances. Use the Zen CLI tool to research large codebases, explore file structures, gather information from multiple files, analyze dependencies, or summarize code sections when the complete context may be too large or overwhelming.

## Creating Zen AI agents

Zen AI agents may be referred to as agents, subagents, or subtasks. Requests may not specifically invoke agents, but you may invoke them directly if warranted. Unless you are specifically asked to use this tool, only create agents when it seems likely you may be exploring across 10 or more files. If users specifically ask that you use this tool, you then must use this tool. Do not use subagents for editing code or executing commands- they should only be used for reading and research to help you better answer questions or build useful context for future coding tasks. If you are performing a search via search_files or the terminal (grep etc.), and the results are long and overwhleming, it is reccomended that you switch to use Zen CLI agents to perform this task. You may perform code edits directly using the write_to_file and replace_in_file tools, and commands using the execute_command tool.

## Command Syntax

You must use the following command syntax for creating Zen AI agents:

\`\`\`bash
zen "your prompt here"
\`\`\`

## Examples of how you might use this tool

\`\`\`bash
# Find specific patterns
zen "find all React components that use the useState hook and list their names"

# Analyze code structure
zen "analyze the authentication flow. Reverse trace through all relevant functions and methods, and provide a summary of how it works. Include file/class references in your summary."

# Gather targeted information
zen "list all API endpoints and their HTTP methods"

# Summarize directories
zen "summarize the purpose of all files in the src/services directory"

# Research implementations
zen "find how error handling is implemented across the application"
\`\`\`

## Tips
- Request brief, technically dense summaries over full file dumps.
- Be specific with your instructions to get focused results.
- Request summaries rather than full file contents. Encourage the agent to be brief, but specific and technically dense with their response.
- If files you want to read are large or complicated, use Zen CLI agents for exploration before instead of reading these files.`;
