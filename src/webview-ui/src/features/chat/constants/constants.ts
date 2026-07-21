import React from "react";
import { Zap, ShieldCheck, Eye } from "lucide-react";
import type {
  PermissionMode,
  PermissionValue,
  TagCategory,
  TagDefinition,
  ToolType,
  UITagType,
  TagType,
} from "../types/tag-types";

// Re-export types for backward compatibility
export type {
  PermissionMode,
  PermissionValue,
  TagCategory,
  TagDefinition,
  ToolType,
  UITagType,
  TagType,
};

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

// ===== TERMINAL STATUS =====
export const TERMINAL_STATUS = {
  BUSY: "busy",
  FREE: "free",
} as const;

export type TerminalStatus =
  (typeof TERMINAL_STATUS)[keyof typeof TERMINAL_STATUS];

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

// ============= UNIFIED TAG REGISTRY =============
export const TAG_REGISTRY: Record<string, TagDefinition> = {
  // ===== TOOLS (category: "tool") =====
  read_file: {
    id: "read_file",
    category: "tool",
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
    category: "tool",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    features: {
      showFileStats: true,
      isFileMutation: true,
    },
    params: {
      required: ["file_path", "content"],
    },
  },

  replace_in_file: {
    id: "replace_in_file",
    category: "tool",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    features: {
      validateFuzzyMatch: true,
      isFileMutation: true,
    },
    params: {
      required: ["file_path", "old_content", "new_content"],
    },
  },

  revert_file: {
    id: "revert_file",
    category: "tool",
    timeout: 60000,
    permissions: {
      readOnly: "reject",
      approval: "confirm",
      fullAccess: "allow",
    },
    features: {
      isFileMutation: true,
    },
  },

  view_replace_history: {
    id: "view_replace_history",
    category: "tool",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
  },

  list_files: {
    id: "list_files",
    category: "tool",
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
    category: "tool",
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
    category: "tool",
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
    category: "tool",
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

  move_file: {
    id: "move_file",
    category: "tool",
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
    category: "tool",
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
    category: "tool",
    timeout: 60000,
    permissions: {
      readOnly: "allow",
      approval: "allow",
      fullAccess: "allow",
    },
  },

  commit_message: {
    id: "commit_message",
    category: "tool",
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
    category: "tool",
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

  // ===== UI TAGS (category: "ui") =====
  markdown: {
    id: "markdown",
    category: "ui",
  },
  thinking: {
    id: "thinking",
    category: "ui",
  },
  question: {
    id: "question",
    category: "ui",
  },
};

// ============= HELPER FUNCTIONS =============

/**
 * Lấy tag definition (bao gồm cả tool và ui tag)
 */
export const getTagDef = (type: string): TagDefinition | undefined => {
  return TAG_REGISTRY[type];
};

/**
 * Lấy tất cả tool types (chỉ tools)
 */
export const getAllToolTypes = (): string[] => {
  return Object.entries(TAG_REGISTRY)
    .filter(([_, def]) => def.category === "tool")
    .map(([key]) => key);
};

/**
 * Lấy tất cả UI tag types (chỉ ui tags)
 */
export const getAllUITagTypes = (): string[] => {
  return Object.entries(TAG_REGISTRY)
    .filter(([_, def]) => def.category === "ui")
    .map(([key]) => key);
};

/**
 * Lấy tất cả tag types (bao gồm cả tool và ui)
 */
export const getAllTagTypes = (): string[] => {
  return Object.keys(TAG_REGISTRY);
};

/**
 * Kiểm tra xem tool có yêu cầu xác nhận hay không dựa trên permission mode hiện tại
 */
export const requiresConfirmation = (
  type: string,
  mode: "readOnly" | "approval" | "fullAccess" = "approval",
): boolean => {
  const tag = getTagDef(type);
  if (!tag || tag.category !== "tool" || !tag.permissions) return false;

  const permission = tag.permissions[mode];
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
  return Object.entries(TAG_REGISTRY)
    .filter(([_, def]) => def.category === "tool")
    .map(([_, def]) => def.id);
};

// ============= HELPER FUNCTIONS FOR FILE STATS =============

export const shouldShowFileStats = (toolType: string): boolean => {
  const tag = getTagDef(toolType);
  return tag?.category === "tool"
    ? (tag.features?.showFileStats ?? false)
    : false;
};

/**
 * Check if a tool should validate fuzzy match before execution
 */
export const shouldValidateFuzzyMatch = (toolType: string): boolean => {
  const tag = getTagDef(toolType);
  return tag?.category === "tool"
    ? (tag.features?.validateFuzzyMatch ?? false)
    : false;
};

/**
 * Get all file mutation tools (tools that modify file content)
 * These are tools like write_to_file, replace_in_file, revert_file
 */
export const FILE_MUTATION_TOOLS = Object.entries(TAG_REGISTRY)
  .filter(([_, def]) => def.features?.isFileMutation === true)
  .map(([key]) => key) as any as readonly [
  "write_to_file",
  "replace_in_file",
  "revert_file",
];

export type FileMutationTool = (typeof FILE_MUTATION_TOOLS)[number];

export const getFileMutationTools = (): readonly string[] => {
  return FILE_MUTATION_TOOLS;
};

/**
 * Get timeout (ms) for a tool. Default: 60000ms (60s)
 */
export const getToolTimeout = (toolType: string): number => {
  const tag = getTagDef(toolType);
  return tag?.category === "tool" ? (tag.timeout ?? 60000) : 60000;
};

/**
 * Check if a tool type is clickable (i.e., it's a tool, not a UI tag)
 * UI tags are not clickable because they're just display content
 */
export const isToolClickable = (type: string): boolean => {
  const tag = getTagDef(type);
  return tag?.category === "tool";
};
