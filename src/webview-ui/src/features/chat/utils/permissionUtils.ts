// src/webview-ui/src/features/chat/utils/permissionUtils.ts
import type { PermissionMode } from "../../../context/SettingsContext";
import { isReadTool } from "../constants/tool-registry";

/**
 * Returns the permission decision for a given tool type and permission mode.
 * - "allow"  → execute immediately without prompting
 * - "prompt" → pause and ask the user
 * - "deny"   → block execution entirely
 */
export const getPermissionDecision = (
  mode: PermissionMode,
  toolType: string,
): "allow" | "prompt" | "deny" => {
  switch (mode) {
    case "fullAccess":
      return "allow";
    case "approval":
      return isReadTool(toolType) ? "allow" : "prompt";
    case "readOnly":
      return isReadTool(toolType) ? "allow" : "deny";
    default:
      return "prompt";
  }
};
