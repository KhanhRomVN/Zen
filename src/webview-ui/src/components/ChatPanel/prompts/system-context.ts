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

| Field | Value |
|-------|-------|
| **OS** | ${info.os} |
| **IDE** | ${info.ide} |
| **Shell** | ${info.shell} |
| **Home** | ${info.homeDir} |
| **CWD** | ${info.cwd} |
| **Language** | ${info.language} |

## Path Rules
- All file paths MUST be relative to CWD: \`${info.cwd}\`
- Do NOT use bare \`cd\` — combine if needed: \`cd dir && npm install\`
- Use forward slashes (/) for cross-platform compatibility

## Auto-Injected Per Message
- **FILE_STRUCTURE**: Current project file tree
- **ACTIVE_TERMINALS**: Running processes overview
- **PROJECT_CONTEXT**: Content from \`workspace.md\` (plain text lessons/experiences)

## Git Integration
- File edit frequency data available
- Use to identify critical/frequently-modified files (examine these first)`;
};
