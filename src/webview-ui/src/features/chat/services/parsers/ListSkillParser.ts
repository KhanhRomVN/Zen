export interface ListSkillParams {
  [key: string]: never;
}

/**
 * Parse list_skill tool: không có tham số, chỉ liệt kê skill đã cài (local).
 */
export const parseListSkill = (_innerContent: string): ListSkillParams => {
  return {};
};