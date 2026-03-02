export const ACTION_NAMES: Record<string, string> = {
  replace_in_file: "replace_in_file",
  write_to_file: "write_to_file",
  run_command: "Run Command",
};

export const TOOL_LABELS: Record<string, string> = {
  read_file: "Read",
  write_to_file: "Create",
  replace_in_file: "Edit",
  list_files: "Listing",
  search_files: "Searching",
  run_command: "Executing",
  ask_bypass_gitignore: "Asking Bypass",
  default: "Zen",
};

export const TOOL_COLORS: Record<string, string> = {
  read_file: "#3b82f6", // blue
  write_to_file: "#10b981", // green
  replace_in_file: "#10b981", // green
  run_command: "#f59e0b",
  ask_bypass_gitignore: "#8b5cf6", // purple
  default: "#6b7280", // gray
};

export const CLICKABLE_TOOLS = [
  "read_file",
  "write_to_file",
  "replace_in_file",
  "list_files",
  "search_files",
  "run_command",
  "ask_bypass_gitignore",
];

export const MANUAL_CONFIRMATION_TOOLS = [
  "run_command",
  "ask_bypass_gitignore",
];
