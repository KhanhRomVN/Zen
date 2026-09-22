import { extractParamValue } from "../../utils/ToolParser";

export interface ReadSkillParams {
  slug: string;
  _validationError?: string;
}

/**
 * Parse read_skill tool: đọc chi tiết + nội dung markdown đầy đủ của 1 skill
 * theo slug (fetch từ mcp.directory, không phụ thuộc skill đã cài local).
 */
export const parseReadSkill = (innerContent: string): ReadSkillParams => {
  const slug = extractParamValue(innerContent, "slug");

  if (!slug || slug.trim() === "") {
    const errorMsg = "Missing required parameter: slug";
    console.error("[Zen][ReadSkillParser] Validation error:", {
      error: errorMsg,
      innerContent: innerContent.substring(0, 200),
    });
    return {
      slug: "",
      _validationError: errorMsg,
    };
  }

  return { slug };
};