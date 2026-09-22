import { extractParamValue } from "../../utils/ToolParser";

export interface SearchSkillParams {
  search_term: string;
  _validationError?: string;
}

/**
 * Parse search_skill tool: tìm skill trên mcp.directory theo search_term.
 */
export const parseSearchSkill = (innerContent: string): SearchSkillParams => {
  const searchTerm = extractParamValue(innerContent, "search_term");

  if (!searchTerm || searchTerm.trim() === "") {
    const errorMsg = "Missing required parameter: search_term";
    console.error("[Zen][SearchSkillParser] Validation error:", {
      error: errorMsg,
      innerContent: innerContent.substring(0, 200),
    });
    return {
      search_term: "",
      _validationError: errorMsg,
    };
  }

  return { search_term: searchTerm };
};