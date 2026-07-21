export const buildAccessModePrompt = (mode: string): string => {
  const isReadOnly = mode === "readOnly";
  const category = isReadOnly ? "read-only" : "action";

  return `# PERMISSION MODE: ${mode} (${category})
- **fullAccess**: all tools auto-execute — read_file, list_files, grep, replace_in_file, write_to_file, delete_file, move_file, run_command. EXCEPTION: any command/operation matching DESTRUCTIVE-COMMAND-CONFIRM (see CONSTRAINTS) still requires a <question type="confirm"> first, regardless of this mode.
- **readOnly**: ONLY read_file, list_files, grep are allowed. The following are BLOCKED and must never be called in this mode: replace_in_file, write_to_file, delete_file, move_file, run_command. If the task requires any blocked tool, state plainly that this action is blocked by read-only mode (do not claim it's impossible in general) and ask the user to switch to a higher permission mode before continuing.
If the previous message was under an action mode fullAccess and this message is read-only: stop execution, notify the user, and ask them to switch to a higher permission mode before continuing.`;
};
