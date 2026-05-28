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
  delete_file: "Delete",
  delete_folder: "Delete",
  run_command: "Executing",
  default: "Zen",
};

export const TOOL_COLORS: Record<string, string> = {
  read_file: "#3b82f6",
  write_to_file: "#10b981",
  replace_in_file: "#10b981",
  delete_file: "#ef4444",
  delete_folder: "#ef4444",
  run_command: "#f59e0b",
  default: "#6b7280",
};

export const CLICKABLE_TOOLS = [
  "read_file",
  "write_to_file",
  "replace_in_file",
  "list_files",
  "search_files",
  "delete_file",
  "delete_folder",
  "run_command",
];

export const MANUAL_CONFIRMATION_TOOLS = [
  "run_command",
];
