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
OS: ${info.os}, IDE: ${info.ide}, Shell: ${info.shell}, Home: ${info.homeDir}, CWD: ${info.cwd}, Language: ${info.language}
## Path Rules
- All paths MUST be relative to CWD: \`${info.cwd}\`
- Do NOT use bare \`cd\` — combine: \`cd dir && npm install\`
- Use forward slashes (/) for cross-platform compatibility
## Auto-Injected Per Message
- **FILE_STRUCTURE**: Current project file tree
- **ACTIVE_TERMINALS**: Running processes
- **PROJECT_CONTEXT**: \`workspace.md\` content (bullet list: \`- <point>\`)`;
};
