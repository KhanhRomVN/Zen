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

// ===== TOOL COLORS =====


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

// ===== TOOL TIMEOUTS (MS) =====
export const TOOL_TIMEOUT = 60000;

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
