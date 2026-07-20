/**
 * Tool Parameter Validator
 * Validates that required parameters are present and suggests corrections for common mistakes
 */

import type { ExecutableToolType } from "../constants/tool-registry";

export interface ToolParamValidation {
  isValid: boolean;
  missingParams?: string[];
  errorMessage?: string;
  errorCode?: "MISSING_REQUIRED_PARAM";
}

/**
 * Tool schema definitions - maps tool names to their required parameters
 */
const TOOL_SCHEMAS: Record<
  string,
  {
    required: string[];
    optional?: string[];
  }
> = {
  write_to_file: {
    required: ["file_path", "content"],
  },
  read_file: {
    required: ["file_path"],
    optional: ["start_line", "end_line"],
  },
  replace_in_file: {
    required: ["file_path", "old_content", "new_content"],
  },
  list_files: {
    required: ["folder_path"],
    optional: ["type"],
  },
  find_files: {
    required: ["file_name"],
  },
  grep: {
    required: ["search_term"],
    optional: ["folder_path"],
  },
  delete_file: {
    required: ["file_path"],
  },
  delete_folder: {
    required: ["folder_path"],
  },
  move_file: {
    required: ["file_path", "target_folder_path"],
  },
  run_command: {
    required: ["command"],
    optional: ["cwd"],
  },
  git_diff: {
    required: [],
    optional: ["file_path"],
  },
  commit_message: {
    required: ["message"],
  },
};

/**
 * Validate tool parameters after parsing
 * Detects missing required params
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

  // Check each required param
  for (const requiredParam of schema.required) {
    const value = params[requiredParam];
    const isEmpty = value === null || value === undefined || value === "";

    if (isEmpty) {
      missingParams.push(requiredParam);
    }
  }

  // Report missing params (if any)
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
