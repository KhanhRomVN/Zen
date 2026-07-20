import {
  PermissionMode,
  TOOL_REGISTRY,
  type PermissionValue,
} from "../constants/constants";

/**
 * Returns the permission decision for a given tool type and permission mode.
 * - "allow"   → execute immediately without prompting
 * - "confirm" → pause and ask the user (hiển thị Accept/Reject buttons)
 * - "reject"  → block execution entirely
 */
export const getPermissionDecision = (
  mode: PermissionMode,
  toolType: string,
): "allow" | "confirm" | "reject" => {
  const toolDef = TOOL_REGISTRY[toolType];
  if (!toolDef) {
    return "reject";
  }

  let permissionValue: PermissionValue;

  switch (mode) {
    case "fullAccess":
      permissionValue = toolDef.permissions.fullAccess;
      break;
    case "approval":
      permissionValue = toolDef.permissions.approval;
      break;
    case "readOnly":
      permissionValue = toolDef.permissions.readOnly;
      break;
    default:
      return "confirm";
  }

  // Nếu là string, return trực tiếp
  if (typeof permissionValue === "string") {
    return permissionValue;
  }

  // Nếu là regex, kiểm tra match
  if (permissionValue instanceof RegExp) {
    return permissionValue.test(toolType) ? "allow" : "reject";
  }

  return "reject";
};
