import { TAG_REGISTRY } from "../constants/constants";
import { PermissionMode, PermissionValue } from "../types/tag-types";

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
  const tagDef = TAG_REGISTRY[toolType];

  // Nếu không tìm thấy hoặc không phải tool hoặc không có permissions
  if (!tagDef || tagDef.category !== "tool" || !tagDef.permissions) {
    return "reject";
  }

  let permissionValue: PermissionValue;

  switch (mode) {
    case "fullAccess":
      permissionValue = tagDef.permissions.fullAccess;
      break;
    case "approval":
      permissionValue = tagDef.permissions.approval;
      break;
    case "readOnly":
      permissionValue = tagDef.permissions.readOnly;
      break;
    default:
      return "confirm";
  }

  if (typeof permissionValue === "string") {
    return permissionValue;
  }

  if (permissionValue instanceof RegExp) {
    const result = permissionValue.test(toolType) ? "allow" : "reject";
    return result;
  }
  return "reject";
};
