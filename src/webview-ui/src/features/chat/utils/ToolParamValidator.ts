/**
 * Tool Parameter Validator
 * Validates that required parameters are present and suggests corrections for common mistakes
 */

import { TOOL_REGISTRY, type ToolType } from "../constants/constants";

export interface ToolParamValidation {
  isValid: boolean;
  missingParams?: string[];
  errorMessage?: string;
  errorCode?: "MISSING_REQUIRED_PARAM";
}

/**
 * Validate tool parameters after parsing
 * Detects missing required params
 */
export const validateToolParams = (
  toolName: ToolType | string,
  params: Record<string, any>,
): ToolParamValidation => {
  const toolDef = TOOL_REGISTRY[toolName];
  const schema = toolDef?.params;
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
