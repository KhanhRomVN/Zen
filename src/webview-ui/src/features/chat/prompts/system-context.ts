import type { SystemPromptMode } from "./mode-config";
import { MODE_BEHAVIORS, MAX_READ_LINES_PER_TURN } from "./mode-config";

export interface SystemInfo {
  os: string;
  shell: string;
  homeDir: string;
  cwd: string;
  language: string;
  /**
   * Optional AUTHORING target — distinct from the actual execution host.
   * Use this only when the user wants OS-specific syntax/conventions for a
   * DIFFERENT OS than the one this session is actually running on (e.g.
   * "write me a .ps1 for our Windows build box" while this session itself
   * runs on Linux). It never changes what `run_command` actually executes
   * on — see the "Authoring Target Differs From Execution Host" block below,
   * which only appears when there is a real mismatch to warn about.
   *
   * `maxFilesPerSession` used to live here as a second, independent source
   * for MAX-FILES-PER-REQUEST. It has been removed: writing's limit is now
   * derived from the current mode's `maxBatchSize` (see mode-config.ts), the
   * same number WRITE-BATCH-LIMIT in constraints.ts uses, so the two rules
   * can never disagree for the same mode again. Reading no longer has a
   * file-count field at all — see MAX_READ_LINES_PER_TURN in mode-config.ts,
   * a flat, exact-line-count cap shared by every mode.
   */
  targetOS?: "auto" | "windows" | "linux";
}

export const buildSystemContext = (
  info: SystemInfo,
  mode: SystemPromptMode = "balanced",
): string => {
  const behavior = MODE_BEHAVIORS[mode];
  // Single source of truth — shared with WRITE-BATCH-LIMIT in constraints.ts.
  const maxFiles = behavior.maxBatchSize;

  const realIsWindows = /windows/i.test(info.os);
  const authoringOS =
    info.targetOS === "windows"
      ? "Windows"
      : info.targetOS === "linux"
        ? "Linux / macOS"
        : undefined;
  const authoringDiffersFromHost =
    authoringOS !== undefined &&
    authoringOS.toLowerCase().includes("windows") !== realIsWindows;

  const authoringNote = authoringDiffersFromHost
    ? `
## ⚠ Authoring Target Differs From Execution Host
- Authoring target (for syntax/conventions ONLY, e.g. a script meant to run elsewhere): **${authoringOS}**
- Actual execution host (what \`run_command\` really runs on, right here, right now): **${info.os}**, Shell: \`${info.shell}\`
- \`run_command\` ALWAYS executes on the real host above — never on the authoring target. Only use the authoring-target OS to decide the SYNTAX of a file you are writing for someone else to run elsewhere. Do NOT feed Windows-only syntax (PowerShell, backslash paths, etc.) into \`run_command\` on this ${info.os} host, or vice versa.
`
    : "";

  return `# SYSTEM ENVIRONMENT
OS: ${info.os}, Shell: ${info.shell}, Home: ${info.homeDir}, CWD: ${info.cwd}, Language: ${info.language}
${authoringNote}## Path & Execution Limits
- All paths MUST be relative to CWD: \`${info.cwd}\`
- Do NOT use bare \`cd\` — combine: \`cd dir && npm install\`
- Use forward slashes (/) for cross-platform compatibility in tool calls (read_file, write_to_file, etc.)
- **READ-LINE-BUDGET**: read_file has NO limit on the number of files per turn. Instead, sum the line-count metadata already returned by list_files/find_files/grep for every candidate file and keep the total at or under ${MAX_READ_LINES_PER_TURN} lines per turn — an exact count, not an estimate. See READ-LINE-BUDGET in CONSTRAINTS for the full rule; this number is the same fixed constant for every mode.
- **MAX-WRITE-FILES-PER-REQUEST**: For write_to_file, replace_in_file, and delete_file, you are allowed to autonomously modify up to ${maxFiles} files per turn without asking for user confirmation (this is the same number as WRITE-BATCH-LIMIT for the current "${mode}" mode — they are the same limit, quoted twice for visibility). For subsequent requests or follow-up turns, you can continue to freely process files (up to ${maxFiles} files per turn) without a lifetime session lock.
`;
};
