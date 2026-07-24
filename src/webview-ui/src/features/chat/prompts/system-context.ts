export interface SystemInfo {
  os: string;
  ide: string;
  shell: string;
  homeDir: string;
  cwd: string;
  language: string;
}

export const buildSystemContext = (info: SystemInfo): string => {
  const isWindowsShell = /cmd\.exe|powershell/i.test(info.shell);

  return `# SYSTEM ENVIRONMENT
OS: ${info.os}, IDE: ${info.ide}, Shell: ${info.shell}, Home: ${info.homeDir}, CWD: ${info.cwd}, Language: ${info.language}
## Path Rules
- All paths MUST be relative to CWD: \`${info.cwd}\`
- Do NOT use bare \`cd\` — combine: \`cd dir && npm install\`
- Use forward slashes (/) for cross-platform compatibility in tool calls (read_file, write_to_file, etc.)${
    isWindowsShell
      ? '\n- This shell is Windows-based (cmd.exe/PowerShell): inside run_command strings specifically, use the shell\'s native path syntax and always quote paths containing spaces (e.g. "C:\\\\Program Files\\\\...").'
      : ""
  }
## Auto-Injected Per Message
- **FILE_STRUCTURE**: Current project file tree
- **ACTIVE_TERMINALS**: Running processes — check before starting new dev servers/watch commands (see CHECK-RUNNING-PROCESSES in CONSTRAINTS)
`;
};
