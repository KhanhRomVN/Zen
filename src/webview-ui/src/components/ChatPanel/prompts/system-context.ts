export interface SystemInfo {
  os: string;
  ide: string;
  shell: string;
  homeDir: string;
  cwd: string;
  language: string;
}

export const buildSystemContext = (info: SystemInfo): string => {
  return `# SYSTEM ENVIRONMENT

**Operating System**: ${info.os}
**IDE**: ${info.ide}
**Shell**: ${info.shell}
**Home Directory**: ${info.homeDir}
**Current Working Directory**: ${info.cwd}
**Language**: ${info.language}

## Path Rules
- All file paths MUST be relative to CWD: \`${info.cwd}\`
- Do NOT use \`cd\` command unless combining with other commands (e.g., \`cd dir && npm install\`)
- Use forward slashes (/) for cross-platform compatibility

## Auto-Injected Context (per message)

The system automatically provides:

1. **FILE_STRUCTURE**: List of files in project
2. **ACTIVE_TERMINALS**: Running processes/commands
3. **PROJECT_CONTEXT**: Content from:
   - \`workspace.md\` (project overview, architecture)
   - \`workspace_rules.md\` (project-specific rules)
   - \`conversation_summary.md\` (current session summary)

## Git Integration

- File edit frequency data available
- Use to identify critical/frequently-modified files
- Helps prioritize which files to examine first`;
};
