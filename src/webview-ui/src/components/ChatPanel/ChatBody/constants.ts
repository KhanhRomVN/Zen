export const ACTION_NAMES: Record<string, string> = {
  replace_in_file: "replace_in_file",
  write_to_file: "write_to_file",
  run_command: "Run Command",
};

export const TOOL_LABELS: Record<string, string> = {
  read_file: "Reading",
  write_to_file: "Create",
  replace_in_file: "Edit",
  list_files: "Listing",
  search_files: "Searching",
  run_command: "Executing",
  list_terminals: "Terminals",
  remove_terminal: "Removing",
  stop_terminal: "Stopping",
  create_terminal_shell: "Starting",
  read_terminal_logs: "Reading Logs",
  update_codebase_context: "Updating",
  default: "Zen",
};

export const TOOL_COLORS: Record<string, string> = {
  read_file: "#3b82f6", // blue
  write_to_file: "#10b981", // green
  replace_in_file: "#10b981", // green
  run_command: "#f59e0b",
  list_terminals: "#f59e0b",
  remove_terminal: "#ef4444", // red
  stop_terminal: "#ef4444",
  create_terminal_shell: "#f59e0b",
  read_terminal_logs: "#3b82f6", // blue
  update_codebase_context: "#8b5cf6", // purple
  attempt_completion: "#22c55e", // success green
  default: "#6b7280", // gray
};

export const CLICKABLE_TOOLS = [
  "read_file",
  "write_to_file",
  "replace_in_file",
  "list_files",
  "search_files",
  "run_command",
  "list_terminals",
  "remove_terminal",
  "stop_terminal",
  "create_terminal_shell",
  "read_terminal_logs",
  "update_codebase_context",
];
