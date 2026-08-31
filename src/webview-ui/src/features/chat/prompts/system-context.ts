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
  const maxFiles = info.maxFilesPerSession ?? 3;

  return `# SYSTEM ENVIRONMENT
OS: ${effectiveOS}, IDE: ${info.ide}, Shell: ${isWindows ? "PowerShell / CMD" : info.shell}, Home: ${info.homeDir}, CWD: ${info.cwd}, Language: ${info.language}
## Path & Execution Limits
- All paths MUST be relative to CWD: \`${info.cwd}\`
- Do NOT use bare \`cd\` — combine: \`cd dir && npm install\`
- Use forward slashes (/) for cross-platform compatibility in tool calls (read_file, write_to_file, etc.)
- **MAX-FILES-PER-REQUEST**: In each request/turn, you are allowed to autonomously read, write, or replace up to ${maxFiles} files without asking for user confirmation. For subsequent requests or follow-up turns, you can continue to freely process files (up to ${maxFiles} files per turn) without lifetime session lock.
`;
};
