export interface SystemInfo {
  os: string;
  ide: string;
  shell: string;
  homeDir: string;
  cwd: string;
  language: string;
  targetOS?: "auto" | "windows" | "linux";
  maxFilesPerSession?: number;
}

export const buildSystemContext = (info: SystemInfo): string => {
  const effectiveOS =
    info.targetOS === "windows"
      ? "Windows"
      : info.targetOS === "linux"
        ? "Linux / macOS"
        : info.os;

  const isWindows = /windows/i.test(effectiveOS);
  const maxFiles = info.maxFilesPerSession ?? 5;

  return `# SYSTEM ENVIRONMENT
OS: ${effectiveOS}, IDE: ${info.ide}, Shell: ${isWindows ? "PowerShell / CMD" : info.shell}, Home: ${info.homeDir}, CWD: ${info.cwd}, Language: ${info.language}
## Path & Session Limits
- All paths MUST be relative to CWD: \`${info.cwd}\`
- Do NOT use bare \`cd\` — combine: \`cd dir && npm install\`
- Use forward slashes (/) for cross-platform compatibility in tool calls (read_file, write_to_file, etc.)
- **MAX-FILES-PER-SESSION**: You are allowed to read or write at most ${maxFiles} files in this conversation session. Count each read_file, write_to_file, and replace_in_file call. When you reach the limit of ${maxFiles} files, stop and inform the user.
`;
};
