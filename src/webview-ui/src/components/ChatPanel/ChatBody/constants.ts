export const ACTION_NAMES: Record<string, string> = {
  replace_in_file: "replace_in_file",
  write_to_file: "write_to_file",
  execute_command: "Run Command",
};

export const TOOL_LABELS: Record<string, string> = {
  read_file: "Reading",
  write_to_file: "Create",
  replace_in_file: "Edit",
  list_files: "Listing",
  search_files: "Searching",
  execute_command: "Executing",
  list_terminals: "Terminals",
  close_terminal: "Closing",
  focus_terminal: "Focusing",
  send_interrupt: "Interrupting",
  send_terminal_input: "Inputting",
  update_codebase_context: "Updating",
  default: "Zen",
};

export const TOOL_COLORS: Record<string, string> = {
  read_file: "#3b82f6", // blue
  write_to_file: "#10b981", // green
  replace_in_file: "#10b981", // green
  execute_command: "#f59e0b", // orange
  list_terminals: "#f59e0b",
  close_terminal: "#ef4444", // red
  focus_terminal: "#f59e0b",
  send_interrupt: "#ef4444",
  send_terminal_input: "#f59e0b",
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
  "execute_command",
  "list_terminals",
  "close_terminal",
  "focus_terminal",
  "send_interrupt",
  "send_terminal_input",
  "update_codebase_context",
];
