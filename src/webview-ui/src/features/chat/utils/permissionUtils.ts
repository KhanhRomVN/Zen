import { TAG_REGISTRY } from "../constants/constants";

/**
 * Returns the decision for a given tool type.
 * - "allow"  → registered tool, execute immediately
 * - "reject" → unknown / non-tool tag, block execution
 */
export const getPermissionDecision = (toolType: string): "allow" | "reject" => {
  const tagDef = TAG_REGISTRY[toolType];
  return tagDef && tagDef.category === "tool" ? "allow" : "reject";
};