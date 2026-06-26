/**
 * Decode common HTML entities back to their original characters.
 * (Internal helper — not exported)
 */
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
};

// Re-export so ToolParser can import from one place without duplicating.
export { decodeHtmlEntities };

/**
 * Maps every known AI-generated variant of a tool tag name to its canonical
 * form. Variants are derived from observed model behaviour: camelCase,
 * PascalCase, mixed snake_case, partial capitalisation, etc.
 */
const TAG_VARIANTS: Record<string, string[]> = {
  read_file: [
    "readFile",
    "ReadFile",
    "read_File",
    "ReadFile",
    "readfile",
    "READFILE",
    "Read_File",
    "read_file",
    "Readfile",
    "readFile",
    "READ_FILE",
  ],
  write_to_file: [
    "writeToFile",
    "WriteToFile",
    "write_to_File",
    "WritetoFile",
    "writetofile",
    "WRITETOFILE",
    "Write_To_File",
    "write_to_file",
    "writefile",
    "WriteFile",
    "WRITE_TO_FILE",
    "write_toFile",
    "writeTofile",
    "WriteTo_File",
  ],
  replace_in_file: [
    "replaceInFile",
    "ReplaceInFile",
    "replace_in_File",
    "ReplaceInfile",
    "replaceinfile",
    "REPLACEINFILE",
    "Replace_In_File",
    "replace_in_file",
    "replaceFile",
    "ReplaceFile",
    "REPLACE_IN_FILE",
    "replace_InFile",
    "replaceInfile",
    "Replace_in_file",
  ],
  list_files: [
    "listFiles",
    "ListFiles",
    "list_Files",
    "ListFile",
    "listfiles",
    "LISTFILES",
    "List_Files",
    "list_file",
    "ListFile",
    "listFile",
    "LIST_FILES",
    "list_Files",
  ],
  run_command: [
    "runCommand",
    "RunCommand",
    "run_Command",
    "RunCommand",
    "runcommand",
    "RUNCOMMAND",
    "Run_Command",
    "run_command",
    "Runcommand",
    "runCommand",
    "RUN_COMMAND",
  ],
  execute_agent_action: [
    "executeAgentAction",
    "ExecuteAgentAction",
    "execute_agent_Action",
    "executeagentaction",
    "EXECUTEAGENTACTION",
    "Execute_Agent_Action",
    "executeAgent",
    "ExecuteAgent",
    "EXECUTE_AGENT_ACTION",
  ],
  delete_file: [
    "deleteFile",
    "DeleteFile",
    "delete_File",
    "DeleteFile",
    "deletefile",
    "DELETEFILE",
    "Delete_File",
    "delete_file",
    "Deletefile",
    "deleteFile",
    "DELETE_FILE",
  ],
  delete_folder: [
    "deleteFolder",
    "DeleteFolder",
    "delete_Folder",
    "DeleteFolder",
    "deletefolder",
    "DELETEFOLDER",
    "Delete_Folder",
    "delete_folder",
    "Deletefolder",
    "deleteFolder",
    "DELETE_FOLDER",
  ],
  move_file: [
    "moveFile",
    "MoveFile",
    "move_File",
    "MoveFile",
    "movefile",
    "MOVEFILE",
    "Move_File",
    "move_file",
    "Movefile",
    "moveFile",
    "MOVE_FILE",
  ],
  grep: ["Grep", "GREP"],
  git_diff: ["gitDiff", "GitDiff", "git-diff", "Git_Diff", "gitdiff", "GIT_DIFF"],
};

/**
 * Normalize all known tag name variants to their canonical forms, and also
 * handle the simple singular-form aliases (search_file → search_files, etc.).
 */
export const normalizeTagVariants = (content: string): string => {
  let result = content;

  // Normalize singular/variant tool tag names to canonical forms
  result = result
    .replace(/<(\/?)search_file>/gi, "<$1search_files>")
    .replace(/<(\/?)list_file>/gi, "<$1list_files>");

  // Explicit variant normalization via TAG_VARIANTS map
  for (const [canonical, variants] of Object.entries(TAG_VARIANTS)) {
    const escaped = variants.map((v) =>
      v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    const pattern = new RegExp(
      `<(\\/?)(${escaped.join("|")})(\\s[^>]*)?\\s*>`,
      "g",
    );
    result = result.replace(
      pattern,
      (_m, slash: string, _tag: string, attrs: string | undefined) =>
        `<${slash}${canonical}${attrs ?? ""}>`,
    );
  }

  return result;
};