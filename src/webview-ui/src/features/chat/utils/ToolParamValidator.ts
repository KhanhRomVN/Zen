/**
 * Tool Parameter Validator
 * Validates that required parameters are present and suggests corrections for common mistakes
 */

import type { ExecutableToolType } from "../constants/tool-registry";

export interface ToolParamValidation {
  isValid: boolean;
  missingParams?: string[];
  invalidParams?: Array<{
    found: string;
    expected: string[];
    message: string;
  }>;
  errorMessage?: string;
  errorCode?: "MISSING_REQUIRED_PARAM" | "INVALID_PARAM_NAME";
}

/**
 * Tool schema definitions - maps tool names to their required parameters
 */
const TOOL_SCHEMAS: Record<
  string,
  {
    required: string[];
    optional?: string[];
    aliases?: Record<string, string[]>; // canonical -> [variants]
  }
> = {
  write_to_file: {
    required: ["file_path", "content"],
    aliases: {
      file_path: ["path", "filePath", "filepath"],
      content: ["text", "body"],
    },
  },
  read_file: {
    required: ["file_path"],
    optional: ["start_line", "end_line"],
    aliases: {
      file_path: ["path", "filePath", "filepath"],
    },
  },
  replace_in_file: {
    required: ["file_path", "search_text", "replace_text"],
    aliases: {
      file_path: ["path", "filePath", "filepath"],
      search_text: ["search", "old", "oldText"],
      replace_text: ["replace", "new", "newText"],
    },
  },
  list_files: {
    required: ["folder_path"],
    optional: ["type"],
    aliases: {
      folder_path: ["path", "folderPath", "directory"],
    },
  },
  find_files: {
    required: ["file_names"],
    aliases: {
      file_names: ["filenames", "file_name", "filename", "names"],
    },
  },
  grep: {
    required: ["search_text"],
    optional: ["folder_path"],
    aliases: {
      search_text: ["search", "query", "pattern"],
      folder_path: ["path", "folderPath", "directory"],
    },
  },
  delete_file: {
    required: ["file_path"],
    aliases: {
      file_path: ["path", "filePath", "filepath"],
    },
  },
  delete_folder: {
    required: ["folder_path"],
    aliases: {
      folder_path: ["path", "folderPath", "directory"],
    },
  },
  move_file: {
    required: ["file_path", "target_folder_path"],
    aliases: {
      file_path: ["path", "filePath", "filepath", "source"],
      target_folder_path: ["target", "destination", "dest"],
    },
  },
  run_command: {
    required: ["command"],
    optional: ["cwd"],
    aliases: {
      command: ["cmd", "shell"],
    },
  },
  git_diff: {
    required: [],
    optional: ["file_path"],
    aliases: {
      file_path: ["path", "filePath", "filepath"],
    },
  },
  commit_message: {
    required: ["message"],
    aliases: {
      message: ["msg", "text"],
    },
  },
};

/**
 * Extract all param tags found in the inner content
 * Returns a set of tag names that were actually present
 */
const extractFoundParamTags = (innerContent: string): Set<string> => {
  const foundTags = new Set<string>();
  const tagRegex = /<([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s+[^>]*)?>[\s\S]*?<\/\1>/g;
  const selfClosingRegex = /<([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s+[^>]*)?\/>/g;

  let match;
  while ((match = tagRegex.exec(innerContent)) !== null) {
    foundTags.add(match[1]);
  }
  while ((match = selfClosingRegex.exec(innerContent)) !== null) {
    foundTags.add(match[1]);
  }

  return foundTags;
};

/**
 * Validate tool parameters after parsing
 * Detects missing required params and suggests corrections for common naming mistakes
 */
export const validateToolParams = (
  toolName: ExecutableToolType | string,
  params: Record<string, any>,
  innerContent: string,
): ToolParamValidation => {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    // No schema defined - assume valid (for tools we don't validate yet)
    return { isValid: true };
  }

  const missingParams: string[] = [];
  const invalidParams: Array<{
    found: string;
    expected: string[];
    message: string;
  }> = [];

  // Extract tags that were actually found in the XML
  const foundTags = extractFoundParamTags(innerContent);

  // Check each required param
  for (const requiredParam of schema.required) {
    const value = params[requiredParam];
    const isEmpty = value === null || value === undefined || value === "";

    if (isEmpty) {
      missingParams.push(requiredParam);

      // Check if user used ANY valid variant (canonical or alias)
      const aliases = schema.aliases?.[requiredParam] || [];
      const allValidNames = [requiredParam, ...aliases];
      
      // Find if ANY valid variant is present in the XML
      const foundValidVariant = allValidNames.find((name) => foundTags.has(name));
      
      // Find if user used a completely INVALID name (not in our list)
      const allFoundTags = Array.from(foundTags);
      const invalidTag = allFoundTags.find((tag) => {
        // Check if this tag looks like it might be intended for this param
        // (contains part of the canonical name or common keywords)
        const looksRelated = tag.toLowerCase().includes(requiredParam.toLowerCase().split("_")[0]);
        const isNotValid = !allValidNames.includes(tag);
        return looksRelated && isNotValid;
      });

      if (foundValidVariant) {
        // User used a valid variant (canonical or alias), but extractParam somehow failed
        // This could be due to malformed XML or other parsing issues
        // Don't mark as INVALID_PARAM_NAME since the name is actually correct
        console.warn(
          `[Zen][ToolParamValidator] Found valid param tag <${foundValidVariant}> but value is empty. Possible XML parsing issue.`
        );
      } else if (invalidTag) {
        // User used a completely invalid parameter name (not canonical, not alias)
        invalidParams.push({
          found: invalidTag,
          expected: allValidNames,
          message: `Found <${invalidTag}> which is not a valid parameter name. Expected <${requiredParam}> or one of these variants: ${allValidNames.join(", ")}`,
        });
      }
    }
  }

  // If we have invalid params (wrong naming), prioritize that error
  if (invalidParams.length > 0) {
    const wrongParam = invalidParams[0];
    return {
      isValid: false,
      invalidParams,
      errorMessage: `Invalid parameter name in <${toolName}>: found <${wrongParam.found}> which is not recognized. Expected <${wrongParam.expected[0]}>. Valid variants: ${wrongParam.expected.join(", ")}`,
      errorCode: "INVALID_PARAM_NAME",
    };
  }

  // Otherwise, report missing params (if any)
  if (missingParams.length > 0) {
    return {
      isValid: false,
      missingParams,
      errorMessage: `Missing required parameter(s) in <${toolName}>: ${missingParams.join(", ")}. Please ensure all required parameters are present.`,
      errorCode: "MISSING_REQUIRED_PARAM",
    };
  }

  return { isValid: true };
};
