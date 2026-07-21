/**
 * Tool Parameter Validator
 * Validates that required parameters are present and suggests corrections for common mistakes
 */

import { TAG_REGISTRY } from "../constants/constants";
import type { ToolType } from "../types/tag-types";

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
  const toolDef = TAG_REGISTRY[toolName];
  // Chỉ validate nếu là tool (không phải ui tag)
  if (!toolDef || toolDef.category !== "tool") {
    return { isValid: true };
  }

  const schema = toolDef.params;
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
