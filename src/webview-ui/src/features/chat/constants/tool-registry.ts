// ============= TYPES =============
export type ToolCategory = "read" | "write" | "git" | "system" | "ui";
export type PermissionLevel = "allow" | "prompt" | "deny";

export interface ToolDefinition<TParams = any> {
  // Core identity
  type: string;
  variants: string[];

  // UI metadata
  label: string;
  color: string;

  // Behavior
  category: ToolCategory;
  requiresConfirmation: boolean;
  isClickable: boolean;

  // Execution
  defaultPermission: PermissionLevel;
  timeout: number;

  // Tags for categorization
  tags?: string[];

  // UI features (NEW)
  features?: {
    showFileStats?: boolean; // Show line count for file operations
    validateFuzzyMatch?: boolean; // Validate diff before apply
  };

  // Attribute normalization (NEW)
  attributeAliases?: Record<string, string[]>; // Map canonical name -> variants
}

// ============= TOOL REGISTRY =============
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  read_file: {
    type: "read_file",
    variants: [
      "readFile",
      "ReadFile",
      "read_File",
      "readfile",
      "READFILE",
      "Read_File",
      "Readfile",
      "READ_FILE",
    ],
    label: "Read",
    color: "var(--vscode-textLink-foreground, #3b82f6)",
    category: "read",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 10000,
    tags: ["file", "io"],
    features: {
      showFileStats: true, // Show line count in UI
    },
    attributeAliases: {
      path: ["filePath", "file_path", "FilePath", "File_Path", "FILE_PATH", "filepath"],
    },
  },

  write_to_file: {
    type: "write_to_file",
    variants: [
      "writeToFile",
      "WriteToFile",
      "write_to_File",
      "WritetoFile",
      "writetofile",
      "WRITETOFILE",
      "Write_To_File",
      "writefile",
      "WriteFile",
      "WRITE_TO_FILE",
      "write_toFile",
      "writeTofile",
      "WriteTo_File",
    ],
    label: "Write",
    color: "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)",
    category: "write",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 10000,
    tags: ["file", "io"],
    features: {
      showFileStats: true, // Show line count in UI
    },
    attributeAliases: {
      path: ["filePath", "file_path", "FilePath", "File_Path", "FILE_PATH", "filepath"],
    },
  },

  replace_in_file: {
    type: "replace_in_file",
    variants: [
      "replaceInFile",
      "ReplaceInFile",
      "replace_in_File",
      "ReplaceInfile",
      "replaceinfile",
      "REPLACEINFILE",
      "Replace_In_File",
      "replaceFile",
      "ReplaceFile",
      "REPLACE_IN_FILE",
      "replace_InFile",
      "replaceInfile",
      "Replace_in_file",
    ],
    label: "Replace",
    color: "var(--vscode-editorWarning-foreground, #d4a72c)",
    category: "write",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 10000,
    tags: ["file", "io", "diff"],
    features: {
      validateFuzzyMatch: true, // Validate diff before apply
    },
    attributeAliases: {
      path: ["filePath", "file_path", "FilePath", "File_Path", "FILE_PATH", "filepath"],
    },
  },

  list_files: {
    type: "list_files",
    variants: [
      "listFiles",
      "ListFiles",
      "list_Files",
      "ListFile",
      "listfiles",
      "LISTFILES",
      "List_Files",
      "list_file",
      "listFile",
      "LIST_FILES",
    ],
    label: "List",
    color: "var(--vscode-textLink-foreground, #3b82f6)",
    category: "read",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 10000,
    tags: ["file", "directory"],
    attributeAliases: {
      path: ["dirPath", "dir_path", "DirPath", "Dir_Path", "DIR_PATH", "directoryPath", "directory_path"],
    },
  },

  grep: {
    type: "grep",
    variants: ["Grep", "GREP"],
    label: "Grep",
    color: "var(--vscode-textLink-foreground, #3b82f6)",
    category: "read",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 30000,
    tags: ["search", "file"],
  },

  delete_file: {
    type: "delete_file",
    variants: [
      "deleteFile",
      "DeleteFile",
      "delete_File",
      "deletefile",
      "DELETEFILE",
      "Delete_File",
      "Deletefile",
      "DELETE_FILE",
    ],
    label: "Delete",
    color: "var(--vscode-errorForeground, #ef4444)",
    category: "write",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 10000,
    tags: ["file", "destructive"],
    attributeAliases: {
      path: ["filePath", "file_path", "FilePath", "File_Path", "FILE_PATH", "filepath"],
    },
  },

  delete_folder: {
    type: "delete_folder",
    variants: [
      "deleteFolder",
      "DeleteFolder",
      "delete_Folder",
      "deletefolder",
      "DELETEFOLDER",
      "Delete_Folder",
      "Deletefolder",
      "DELETE_FOLDER",
    ],
    label: "Delete",
    color: "var(--vscode-errorForeground, #ef4444)",
    category: "write",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 10000,
    tags: ["directory", "destructive"],
    attributeAliases: {
      path: ["folderPath", "folder_path", "FolderPath", "Folder_Path", "FOLDER_PATH", "directoryPath", "directory_path"],
    },
  },

  move_file: {
    type: "move_file",
    variants: [
      "moveFile",
      "MoveFile",
      "move_File",
      "movefile",
      "MOVEFILE",
      "Move_File",
      "Movefile",
      "MOVE_FILE",
    ],
    label: "Move",
    color: "var(--vscode-textLink-foreground, #3b82f6)",
    category: "write",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 10000,
    tags: ["file", "io"],
    attributeAliases: {
      source: ["sourcePath", "source_path", "SourcePath", "Source_Path", "SOURCE_PATH", "from", "oldPath", "old_path"],
      destination: ["destPath", "dest_path", "DestPath", "Dest_Path", "DEST_PATH", "to", "newPath", "new_path"],
    },
  },

  run_command: {
    type: "run_command",
    variants: [
      "runCommand",
      "RunCommand",
      "run_Command",
      "runcommand",
      "RUNCOMMAND",
      "Run_Command",
      "Runcommand",
      "RUN_COMMAND",
    ],
    label: "Execute",
    color: "var(--vscode-editorWarning-foreground, #f59e0b)",
    category: "system",
    requiresConfirmation: true,
    isClickable: true,
    defaultPermission: "prompt",
    timeout: 30000,
    tags: ["command", "shell"],
    attributeAliases: {
      command: ["cmd", "Command", "CMD", "commandText", "command_text"],
    },
  },

  git_status: {
    type: "git_status",
    variants: [],
    label: "Git Status",
    color: "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)",
    category: "git",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
    timeout: 10000,
    tags: ["git", "vcs"],
  },

  commit_message: {
    type: "commit_message",
    variants: [],
    label: "Commit Message",
    color: "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)",
    category: "git",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
    timeout: 10000,
    tags: ["git", "vcs"],
  },

  git_diff: {
    type: "git_diff",
    variants: [
      "gitDiff",
      "GitDiff",
      "git-diff",
      "Git_Diff",
      "gitdiff",
      "GIT_DIFF",
    ],
    label: "Git Diff",
    color: "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)",
    category: "git",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "allow",
    timeout: 30000,
    tags: ["git", "vcs", "diff"],
  },

  code: {
    type: "code",
    variants: [],
    label: "Code",
    color: "var(--vscode-textLink-foreground, #3b82f6)",
    category: "ui",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
    timeout: 0,
    tags: ["ui", "display"],
  },

  markdown: {
    type: "markdown",
    variants: [],
    label: "Markdown",
    color: "var(--vscode-foreground)",
    category: "ui",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
    timeout: 0,
    tags: ["ui", "display"],
  },

  thinking: {
    type: "thinking",
    variants: [],
    label: "Thinking",
    color: "var(--vscode-editorBracketHighlight-foreground2, #a855f7)",
    category: "ui",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
    timeout: 0,
    tags: ["ui", "ai"],
  },

  question: {
    type: "question",
    variants: [],
    label: "Question",
    color: "var(--vscode-button-background, #007acc)",
    category: "ui",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
    timeout: 0,
    tags: ["ui", "interaction"],
  },

  context_compression: {
    type: "context_compression",
    variants: ["contextCompression", "ContextCompression", "context_Compression"],
    label: "Context Summary",
    color: "var(--vscode-editorBracketHighlight-foreground2, #10b981)",
    category: "ui",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
    timeout: 0,
    tags: ["ui", "system", "compression"],
  },
};

// ============= HELPER FUNCTIONS =============

export const getToolDef = (type: string): ToolDefinition | undefined => {
  return TOOL_REGISTRY[type];
};

export const getToolDefByVariant = (
  variant: string,
): ToolDefinition | undefined => {
  return Object.values(TOOL_REGISTRY).find(
    (def) => def.type === variant || def.variants.includes(variant),
  );
};

export const getAllToolTypes = (): string[] => {
  return Object.keys(TOOL_REGISTRY);
};

export const getToolColor = (type: string): string => {
  return (
    getToolDef(type)?.color ?? "var(--vscode-descriptionForeground, #6b7280)"
  );
};

export const getToolLabel = (type: string): string => {
  return getToolDef(type)?.label ?? "Unknown";
};

export const requiresConfirmation = (type: string): boolean => {
  return getToolDef(type)?.requiresConfirmation ?? false;
};

export const isToolClickable = (type: string): boolean => {
  return getToolDef(type)?.isClickable ?? false;
};

export const getToolTimeout = (type: string): number => {
  return getToolDef(type)?.timeout ?? 10000;
};

/**
 * Get all tools in a specific category (returns tool type names)
 */
export const getToolsByCategory = (category: ToolCategory): string[] => {
  return Object.values(TOOL_REGISTRY)
    .filter((def) => def.category === category)
    .map((def) => def.type);
};

/**
 * Get all tools that have user-configurable permissions (non-git, non-ui tools)
 */
export const getConfigurableTools = (): string[] => {
  return Object.values(TOOL_REGISTRY)
    .filter((def) => def.category !== "git" && def.category !== "ui")
    .map((def) => def.type);
};

/**
 * Check if a tool is file-related (read, write operations, excludes run_command)
 */
export const isFileTool = (toolType: string): boolean => {
  const def = getToolDef(toolType);
  if (!def) return false;

  // File tools are: read category or write category
  // Explicitly exclude run_command (system category) as it's handled by TerminalToolRenderer
  return (
    (def.category === "read" || def.category === "write") &&
    toolType !== "run_command"
  );
};

/**
 * Get all executable tool types (excludes UI-only tools like code, markdown, thinking, question)
 */
export const getExecutableToolTypes = (): string[] => {
  return Object.values(TOOL_REGISTRY)
    .filter((def) => def.category !== "ui")
    .map((def) => def.type);
};

/**
 * Get all read tools (used for permission decisions)
 */
export const getReadTools = (): string[] => {
  return getToolsByCategory("read");
};

/**
 * Check if a tool is in the read category
 */
export const isReadTool = (toolType: string): boolean => {
  return getToolDef(toolType)?.category === "read";
};

/**
 * Check if a tool should show file stats (line count) in UI
 */
export const shouldShowFileStats = (toolType: string): boolean => {
  return getToolDef(toolType)?.features?.showFileStats ?? false;
};

/**
 * Check if a tool should validate fuzzy match before execution
 */
export const shouldValidateFuzzyMatch = (toolType: string): boolean => {
  return getToolDef(toolType)?.features?.validateFuzzyMatch ?? false;
};

/**
 * Type-safe tool type union generated from registry
 */
export type ToolType = keyof typeof TOOL_REGISTRY;

/**
 * Executable tool type union (excludes UI tools)
 */
export type ExecutableToolType =
  | "read_file"
  | "write_to_file"
  | "replace_in_file"
  | "list_files"
  | "run_command"
  | "delete_file"
  | "delete_folder"
  | "move_file"
  | "grep"
  | "git_status"
  | "commit_message"
  | "git_diff";
