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
  get_outline: "Outline",
  get_definition: "Definition",
  get_references: "References",
  default: "Zen",
};

export const TOOL_COLORS: Record<string, string> = {
  read_file: "#3b82f6",
  write_to_file: "#10b981",
  replace_in_file: "#10b981",
  run_command: "#f59e0b",
  get_outline: "#a855f7",
  get_definition: "#ec4899",
  get_references: "#14b8a6",
  default: "#6b7280",
};

export const CLICKABLE_TOOLS = [
  "read_file",
  "write_to_file",
  "replace_in_file",
  "list_files",
  "search_files",
  "run_command",
  "get_outline",
  "get_definition",
  "get_references",
];

export const MANUAL_CONFIRMATION_TOOLS = [
  "run_command",
];
