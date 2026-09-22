import { extractParamValue } from "../../utils/ToolParser";

export interface InstallSkillParams {
  slug: string;
  _validationError?: string;
}

/**
 * Parse install_skill tool: cài 1 skill vào local (~/.khanhromvn-zen/skills)
 * theo slug — fetch detail đầy đủ rồi lưu, giống luồng nút Install trong UI.
 */
export const parseInstallSkill = (innerContent: string): InstallSkillParams => {
  const slug = extractParamValue(innerContent, "slug");

  if (!slug || slug.trim() === "") {
    const errorMsg = "Missing required parameter: slug";
    console.error("[Zen][InstallSkillParser] Validation error:", {
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