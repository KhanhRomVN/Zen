// ============= TYPES =============
export type PermissionLevel = "allow" | "prompt" | "deny";

export interface ToolDefinition<TParams = any> {
  // Core identity
  type: string;

  // Behavior
  requiresConfirmation: boolean;
  isClickable: boolean;
  defaultPermission: PermissionLevel;

  // UI features
  features?: {
    showFileStats?: boolean; // Show line count for file operations
    validateFuzzyMatch?: boolean; // Validate diff before apply
  };
}

// ============= TOOL REGISTRY =============
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  read_file: {
    type: "read_file",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    features: {
      showFileStats: true,
    },
  },

  write_to_file: {
    type: "write_to_file",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    features: {
      showFileStats: true,
    },
  },

  replace_in_file: {
    type: "replace_in_file",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
    features: {
      validateFuzzyMatch: true,
    },
  },

  revert_file: {
    type: "revert_file",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  view_replace_history: {
    type: "view_replace_history",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  list_files: {
    type: "list_files",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  find_files: {
    type: "find_files",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  grep: {
    type: "grep",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  delete_file: {
    type: "delete_file",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  delete_folder: {
    type: "delete_folder",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  move_file: {
    type: "move_file",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "prompt",
  },

  run_command: {
    type: "run_command",
    requiresConfirmation: true,
    isClickable: true,
    defaultPermission: "prompt",
  },

  git_status: {
    type: "git_status",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
  },

  commit_message: {
    type: "commit_message",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
  },

  git_diff: {
    type: "git_diff",
    requiresConfirmation: false,
    isClickable: true,
    defaultPermission: "allow",
  },

  code: {
    type: "code",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
  },

  markdown: {
    type: "markdown",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
  },

  thinking: {
    type: "thinking",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
  },

  question: {
    type: "question",
    requiresConfirmation: false,
    isClickable: false,
    defaultPermission: "allow",
  },
};

// ============= HELPER FUNCTIONS =============

export const getToolDef = (type: string): ToolDefinition | undefined => {
  return TOOL_REGISTRY[type];
};

export const getToolDefByVariant = (
  variant: string,
): ToolDefinition | undefined => {
  // Since all variants are now empty arrays (strict mode), only match exact type
  return Object.values(TOOL_REGISTRY).find((def) => def.type === variant);
};

export const getAllToolTypes = (): string[] => {
  return Object.keys(TOOL_REGISTRY);
};

export const requiresConfirmation = (type: string): boolean => {
  return getToolDef(type)?.requiresConfirmation ?? false;
};

export const isToolClickable = (type: string): boolean => {
  return getToolDef(type)?.isClickable ?? false;
};

/**
 * Get all tools that have user-configurable permissions (non-git, non-ui tools)
 */
export const getConfigurableTools = (): string[] => {
  return Object.values(TOOL_REGISTRY).map((def) => def.type);
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
  | "revert_file"
  | "view_replace_history"
  | "list_files"
  | "find_files"
  | "run_command"
  | "delete_file"
  | "delete_folder"
  | "move_file"
  | "grep"
  | "git_status"
  | "commit_message"
  | "git_diff";

export const shouldShowFileStats = (toolType: string): boolean => {
  return getToolDef(toolType)?.features?.showFileStats ?? false;
};

/**
 * Check if a tool should validate fuzzy match before execution
 */
export const shouldValidateFuzzyMatch = (toolType: string): boolean => {
  return getToolDef(toolType)?.features?.validateFuzzyMatch ?? false;
};
