import { extractParamValue } from "../../utils/ToolParser";

export interface ReadSkillParams {
  skill_id: string;
  _validationError?: string;
}

/**
 * Parse read_skill tool: đọc chi tiết + nội dung markdown đầy đủ của 1 skill
 * theo skill_id (fetch từ mcp.directory, không phụ thuộc skill đã cài local).
 * XML: <read_skill>skill_id</read_skill> — JSON: {"skill_id":"..."}.
 */
export const parseReadSkill = (innerContent: string): ReadSkillParams => {
  const skillId = (
    extractParamValue(innerContent, "skill_id") || innerContent
  ).trim();

  if (!skillId) {
    const errorMsg = "Missing required parameter: skill_id";
    console.error("[Zen][ReadSkillParser] Validation error:", {
      error: errorMsg,
      innerContent: innerContent.substring(0, 200),
    });
    return {
      skill_id: "",
      _validationError: errorMsg,
    };
  }

  return { skill_id: skillId };
};