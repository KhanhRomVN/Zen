// ===== TOOL TYPES =====
export type ToolType =
  | "read_file"
  | "write_to_file"
  | "replace_in_file"
  | "revert_file"
  | "view_replace_history"
  | "list_files"
  | "find_files"
  | "grep"
  | "delete_file"
  | "delete_folder"
  | "move_file"
  | "run_command"
  | "git_status"
  | "commit_message"
  | "git_diff"
  | "code"
  | "markdown"
  | "thinking"
  | "question";

// ===== ACTION NAMES =====
export const ACTION_NAMES: Record<string, string> = {
  replace_in_file: "replace_in_file",
  write_to_file: "write_to_file",
  run_command: "Run Command",
};

// ===== TOOL LABELS =====
export const TOOL_LABELS: Record<string, string> = {
  read_file: "Read",
  write_to_file: "Write",
  replace_in_file: "Replace",
  revert_file: "Revert",
  view_replace_history: "History",
  list_files: "List",
  find_files: "Find",
  grep: "Grep",
  delete_file: "Delete",
  delete_folder: "Delete",
  move_file: "Move",
  run_command: "Execute",
  git_status: "Git Status",
  commit_message: "Commit Message",
  git_diff: "Git Diff",
  code: "Code",
  markdown: "Markdown",
  thinking: "Thinking",
  question: "Question",
  default: "Zen",
};

// ===== TOOL COLORS =====
export const TOOL_COLORS: Record<string, string> = {
  read_file: "var(--vscode-textLink-foreground, #3b82f6)",
  write_to_file: "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)",
  replace_in_file: "var(--vscode-editorWarning-foreground, #d4a72c)",
  revert_file:
    "var(--vscode-gitDecoration-conflictingResourceForeground, #c74e39)",
  view_replace_history: "var(--vscode-textLink-foreground, #9370db)",
  list_files: "var(--vscode-textLink-foreground, #3b82f6)",
  find_files: "var(--vscode-textLink-foreground, #3b82f6)",
  grep: "var(--vscode-textLink-foreground, #3b82f6)",
  delete_file: "var(--vscode-errorForeground, #ef4444)",
  delete_folder: "var(--vscode-errorForeground, #ef4444)",
  move_file: "var(--vscode-textLink-foreground, #3b82f6)",
  run_command: "var(--vscode-editorWarning-foreground, #f59e0b)",
  git_status: "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)",
  commit_message: "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)",
  git_diff: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
  code: "var(--vscode-textLink-foreground, #3b82f6)",
  markdown: "var(--vscode-foreground)",
  thinking: "var(--vscode-editorBracketHighlight-foreground2, #a855f7)",
  question: "var(--vscode-button-background, #007acc)",
  default: "var(--vscode-descriptionForeground, #6b7280)",
};

// ===== CLICKABLE TOOLS =====
export const CLICKABLE_TOOLS: string[] = [
  "read_file",
  "write_to_file",
  "replace_in_file",
  "revert_file",
  "view_replace_history",
  "list_files",
  "grep",
  "delete_file",
  "delete_folder",
  "move_file",
  "run_command",
  "git_diff",
];

// ===== MANUAL CONFIRMATION TOOLS =====
export const MANUAL_CONFIRMATION_TOOLS: string[] = ["run_command"];

// ===== TOOL PERMISSIONS =====
export const TOOL_PERMISSIONS: Record<string, string> = {
  read_file: "prompt",
  write_to_file: "prompt",
  replace_in_file: "prompt",
  revert_file: "prompt",
  view_replace_history: "prompt",
  list_files: "prompt",
  grep: "read",
  delete_file: "write",
  delete_folder: "write",
  move_file: "prompt",
  run_command: "write",
  git_status: "allow",
  commit_message: "allow",
  git_diff: "allow",
};

// ===== TOOL TIMEOUTS (MS) =====
export const TOOL_TIMEOUT = 60000; // 1 phút cho tất cả tools



// Whitelist of allowed file extensions for external files
export const ALLOWED_FILE_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".css",
  ".html",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".sh",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
];
