import React from "react";
import { Zap, ShieldCheck, Eye } from "lucide-react";

export const STREAM_BOX_HEIGHT = 154;

// Whitelist of allowed file extensions for external files
export const ALLOWED_FILE_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".css",
  ".html",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".sh",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
];

// ===== TOOL ACTION TYPES =====
export const TOOL_ACTION_TYPES = {
  ACCEPT: "accept",
  REJECT: "reject",
} as const;

// ===== EXECUTION STATUS =====
export const EXECUTION_STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  ERROR: "error",
  DONE: "done",
} as const;

// ===== PERMISSION MODE METADATA =====
export const PERMISSION_MODE: Record<
  string,
  { label: string; desc: string; icon: React.ReactNode; color: string }
> = {
  fullAccess: {
    label: "Full Access",
    desc: "AI has unrestricted access to all project files and tools",
    icon: React.createElement(Zap, { size: 11 }),
    color: "var(--vscode-editorBracketHighlight-foreground3, #f59e0b)",
  },
  approval: {
    label: "Approval Required",
    desc: "AI must request explicit approval before accessing files or running commands",
    icon: React.createElement(ShieldCheck, { size: 11 }),
    color: "var(--vscode-symbolIcon-interfaceForeground, #3b82f6)",
  },
  readOnly: {
    label: "Read Only",
    desc: "AI can only read project files, cannot modify them or run commands",
    icon: React.createElement(Eye, { size: 11 }),
    color: "var(--vscode-symbolIcon-classForeground, #8b5cf6)",
  },
};

// ============= TYPES =============
export type PermissionMode = "fullAccess" | "approval" | "readOnly";
export type PermissionValue = "allow" | "confirm" | "reject" | RegExp;

export interface ToolDefinition {
  id: string;

  permissions: {
    readOnly: PermissionValue;
    approval: PermissionValue;
    fullAccess: PermissionValue;
  };

  timeout?: number;

  features?: {
    showFileStats?: boolean;
    validateFuzzyMatch?: boolean;
  };

  params?: {
    required: string[];
    optional?: string[];
  };
}

// ============= TOOL REGISTRY =============
export const TOOL_TAG_REGISTRY: Record<string, ToolDefinition> = {
  read_file: {
    id: "read_file",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
    features: {
      showFileStats: true,
    },
    params: {
      required: ["file_path"],
      optional: ["start_line", "end_line"],
    },
  },

  write_to_file: {
    id: "write_to_file",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    features: {
      showFileStats: true,
    },
    params: {
      required: ["file_path", "content"],
    },
  },

  replace_in_file: {
    id: "replace_in_file",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    features: {
      validateFuzzyMatch: true,
    },
    params: {
      required: ["file_path", "old_content", "new_content"],
    },
  },

  revert_file: {
    id: "revert_file",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
  },

  view_replace_history: {
    id: "view_replace_history",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
  },

  list_files: {
    id: "list_files",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
    params: {
      required: ["folder_path"],
      optional: ["type"],
    },
  },

  find_files: {
    id: "find_files",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
    params: {
      required: ["file_name"],
    },
  },

  grep: {
    id: "grep",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
    params: {
      required: ["search_term"],
      optional: ["folder_path"],
    },
  },

  delete_file: {
    id: "delete_file",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    params: {
      required: ["file_path"],
    },
  },

  delete_folder: {
    id: "delete_folder",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    params: {
      required: ["folder_path"],
    },
  },

  move_file: {
    id: "move_file",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    params: {
      required: ["file_path", "target_folder_path"],
    },
  },

  run_command: {
    id: "run_command",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "confirm",
    },
    params: {
      required: ["command"],
      optional: ["cwd"],
    },
  },

  git_status: {
    id: "git_status",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
  },

  commit_message: {
    id: "commit_message",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
    params: {
      required: ["message"],
    },
  },

  git_diff: {
    id: "git_diff",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },

    params: {
      required: [],
      optional: ["file_path"],
    },
  },
};

// ============= UI TAG REGISTRY =============
// Các thẻ XML/UI để render nội dung, không phải tools thực thi
export interface UITagDefinition {
  id: string;
}

export const UI_TAG_REGISTRY: Record<string, UITagDefinition> = {
  code: {
    id: "code",
  },
  markdown: {
    id: "markdown",
  },
  thinking: {
    id: "thinking",
  },
  question: {
    id: "question",
  },
};

// ============= HELPER FUNCTIONS =============

export const getToolDef = (type: string): ToolDefinition | undefined => {
  return TOOL_TAG_REGISTRY[type];
};

export const getUITagDef = (type: string): UITagDefinition | undefined => {
  return UI_TAG_REGISTRY[type];
};

export const getAllToolTypes = (): string[] => {
  return Object.keys(TOOL_TAG_REGISTRY);
};

export const getAllUITagTypes = (): string[] => {
  return Object.keys(UI_TAG_REGISTRY);
};

/**
 * Kiểm tra xem tool có yêu cầu xác nhận hay không dựa trên permission mode hiện tại
 */
export const requiresConfirmation = (
  type: string,
  mode: "readOnly" | "approval" | "fullAccess" = "approval",
): boolean => {
  const toolDef = getToolDef(type);
  if (!toolDef) return false;

  const permission = toolDef.permissions[mode];
  return permission === "confirm";
};

/**
 * Kiểm tra xem tool hoặc UI tag có nên hiển thị approval UI hay không
 * Dựa trên permission của mode hiện tại
 */
export const shouldShowApprovalUI = (
  type: string,
  mode: "readOnly" | "approval" | "fullAccess" = "approval",
): boolean => {
  return requiresConfirmation(type, mode);
};

/**
 * Get all tools that have user-configurable permissions (non-git, non-ui tools)
 */
export const getConfigurableTools = (): string[] => {
  return Object.values(TOOL_TAG_REGISTRY).map((def) => def.id);
};

/**
 * Type-safe tool type union generated from registry
 */
export type ToolType = keyof typeof TOOL_TAG_REGISTRY;

/**
 * Type-safe UI tag type union generated from registry
 */
export type UITagType = keyof typeof UI_TAG_REGISTRY;

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
 * Get timeout (ms) for a tool. Default: 60000ms (60s)
 */
export const getToolTimeout = (toolType: string): number => {
  return getToolDef(toolType)?.timeout ?? 60000;
};

/**
 * Check if a tool type is clickable (i.e., it's in TOOL_TAG_REGISTRY)
 * UI tags are not clickable because they're just display content
 */
export const isToolClickable = (type: string): boolean => {
  return type in TOOL_TAG_REGISTRY;
};
