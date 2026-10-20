/**
 * Tag and Tool Type Definitions
 *
 * This file contains all type definitions related to tags, tools, and permissions.
 * Extracted from constants.ts for better separation of concerns.
 */


// ============= TAG TYPES =============

export type TagCategory = "tool" | "ui";

export interface TagDefinition {
  id: string;
  title?: string | null;
  category: TagCategory;


  timeout?: number;

  features?: {
    showFileStats?: boolean;
    validateFuzzyMatch?: boolean;
    isFileMutation?: boolean;
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
