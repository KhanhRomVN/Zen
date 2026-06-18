import { ACTION_NAMES, TOOL_LABELS, TOOL_COLORS } from "../constants/constants";

/** Returns the human-readable action name for a tool type. */
export const getActionName = (type: string): string => {
  return ACTION_NAMES[type] || type;
};

/** Returns the display label for a tool type. */
export const getToolLabel = (type: string): string => {
  return TOOL_LABELS[type] || TOOL_LABELS.default;
};

/** Returns the color token for a tool type. */
export const getToolColor = (type: string): string => {
  return TOOL_COLORS[type] || TOOL_COLORS.default;
};

/**
 * Returns a short display name for an action — the filename for file tools,
 * or a truncated command string for run_command.
 */
export const getFilename = (action: any): string => {
  if (action.type === "run_command") {
    const id = action.params.terminal_id || "";
    const cmd = action.params.command || action.params.text || "";
    if (id && cmd)
      return `${id}: ${cmd.substring(0, 30)}${cmd.length > 30 ? "..." : ""}`;
    if (id) return id;
    return cmd.length > 50 ? cmd.substring(0, 50) + "..." : cmd;
  }
  const path =
    action.params.file_path ||
    action.params.folder_path ||
    action.params.path ||
    "";
  return path.split("/").pop() || path || "";
};
