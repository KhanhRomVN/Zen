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
