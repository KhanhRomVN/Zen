// src/webview-ui/src/features/chat/utils/permissionUtils.ts
import type { PermissionMode } from "../../../context/SettingsContext";

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
  const readTools = ["read_file", "list_files", "search_files", "grep"];
  switch (mode) {
    case "fullAccess":
      return "allow";
    case "approval":
      return readTools.includes(toolType) ? "allow" : "prompt";
    case "readOnly":
      return readTools.includes(toolType) ? "allow" : "deny";
    default:
      return "prompt";
  }
};
