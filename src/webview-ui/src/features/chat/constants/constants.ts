// ===== TOOL TYPES =====
export type ToolType =
  | "read_file"
  | "write_to_file"
  | "replace_in_file"
  | "list_files"
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

// ===== TOOL VARIANTS =====
export const TOOL_VARIANTS: Record<string, string[]> = {
  read_file: ["readFile", "ReadFile", "read_File", "readfile", "READFILE", "Read_File", "Readfile", "READ_FILE"],
  write_to_file: ["writeToFile", "WriteToFile", "write_to_File", "WritetoFile", "writetofile", "WRITETOFILE", "Write_To_File", "writefile", "WriteFile", "WRITE_TO_FILE", "write_toFile", "writeTofile", "WriteTo_File"],
  replace_in_file: ["replaceInFile", "ReplaceInFile", "replace_in_File", "ReplaceInfile", "replaceinfile", "REPLACEINFILE", "Replace_In_File", "replaceFile", "ReplaceFile", "REPLACE_IN_FILE", "replace_InFile", "replaceInfile", "Replace_in_file"],
  list_files: ["listFiles", "ListFiles", "list_Files", "ListFile", "listfiles", "LISTFILES", "List_Files", "list_file", "listFile", "LIST_FILES"],
  grep: ["Grep", "GREP"],
  delete_file: ["deleteFile", "DeleteFile", "delete_File", "deletefile", "DELETEFILE", "Delete_File", "Deletefile", "DELETE_FILE"],
  delete_folder: ["deleteFolder", "DeleteFolder", "delete_Folder", "deletefolder", "DELETEFOLDER", "Delete_Folder", "Deletefolder", "DELETE_FOLDER"],
  move_file: ["moveFile", "MoveFile", "move_File", "movefile", "MOVEFILE", "Move_File", "Movefile", "MOVE_FILE"],
  run_command: ["runCommand", "RunCommand", "run_Command", "runcommand", "RUNCOMMAND", "Run_Command", "Runcommand", "RUN_COMMAND"],
  git_diff: ["gitDiff", "GitDiff", "git-diff", "Git_Diff", "gitdiff", "GIT_DIFF"],
};

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
  list_files: "List",
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
  list_files: "var(--vscode-textLink-foreground, #3b82f6)",
  grep: "var(--vscode-textLink-foreground, #3b82f6)",
  delete_file: "var(--vscode-errorForeground, #ef4444)",
  delete_folder: "var(--vscode-errorForeground, #ef4444)",
  move_file: "var(--vscode-textLink-foreground, #3b82f6)",
  run_command: "var(--vscode-editorWarning-foreground, #f59e0b)",
  git_status: "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)",
  commit_message: "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)",
  git_diff: "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)",
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
export const TOOL_TIMEOUTS: Record<string, number> = {
  read_file: 10000,
  write_to_file: 10000,
  replace_in_file: 10000,
  list_files: 10000,
  grep: 30000,
  delete_file: 10000,
  delete_folder: 10000,
  move_file: 10000,
  run_command: 30000,
  git_diff: 30000,
};

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