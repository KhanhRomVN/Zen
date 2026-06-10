export const PERSISTENT_RULES = `<persistent-rules>
Every response MUST start with a <thinking>...</thinking> block containing two sections: "Pass 1 (Plan)" and "Pass 2 (Verify)". No exceptions.
</persistent-rules>`;

/**
 * Full permission mode tag — injected in user-initiated requests only.
 */
export const buildPermissionModeTag = (mode: string): string => {
  const isReadOnly = mode === "readOnly";
  const category = isReadOnly ? "read-only" : "action";

  return `<permission-mode>
Active: ${mode} (${category})
action (fullAccess, approval): all tools allowed — reads auto, writes/run_command auto or approval
read-only (readOnly): only read_file, list_files, search_files — replace_in_file, write_to_file, run_command are BLOCKED
If previous message was action and this is read-only: stop, notify user, ask them to switch to a higher permission mode before continuing.
</permission-mode>`;
};

/**
 * Compact permission mode tag — injected in auto/tool-flush requests only.
 * Contains only the active mode name and category to keep token usage minimal.
 */
export const buildPermissionModeTagCompact = (mode: string): string => {
  const category = mode === "readOnly" ? "read-only" : "action";
  return `<permission-mode>Active: ${mode} (${category}). If this differs from the previous message's category, apply mode-switch rule immediately.</permission-mode>`;
};
