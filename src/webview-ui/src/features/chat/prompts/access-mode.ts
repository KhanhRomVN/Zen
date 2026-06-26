export const buildAccessModePrompt = (mode: string): string => {
  const isReadOnly = mode === "readOnly";
  const category = isReadOnly ? "read-only" : "action";

  return `# PERMISSION MODE: ${mode} (${category})

action (fullAccess, approval): all tools allowed — reads auto, writes/run_command auto or approval
read-only (readOnly): only read_file, list_files, grep — replace_in_file, write_to_file, run_command are BLOCKED

If previous message was action and this is read-only: stop execution, notify user, ask them to switch to a higher permission mode before continuing.`;
};
