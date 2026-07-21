/**
 * Tag and Tool Type Definitions
 * 
 * This file contains all type definitions related to tags, tools, and permissions.
 * Extracted from constants.ts for better separation of concerns.
 */

// ============= PERMISSION TYPES =============

export type PermissionMode = "fullAccess" | "approval" | "readOnly";
export type PermissionValue = "allow" | "confirm" | "reject" | RegExp;

// ============= TAG TYPES =============

export type TagCategory = "tool" | "ui";

export interface TagDefinition {
  id: string;
  category: TagCategory;

  // Only tools have permissions
  permissions?: {
    readOnly: PermissionValue;
    approval: PermissionValue;
    fullAccess: PermissionValue;
  };

  timeout?: number;

  features?: {
    showFileStats?: boolean;
    validateFuzzyMatch?: boolean;
    isFileMutation?: boolean;
  };

  params?: {
    required: string[];
    optional?: string[];
  };
}

/**
 * Type-safe tool type union (only tools)
 * This type is computed from TAG_REGISTRY at runtime
 */
export type ToolType = string;

/**
 * Type-safe UI tag type union (only ui tags)
 * This type is computed from TAG_REGISTRY at runtime
 */
export type UITagType = string;

/**
 * Type-safe unified tag type union (all tags)
 * This type is computed from TAG_REGISTRY at runtime
 */
export type TagType = string;
