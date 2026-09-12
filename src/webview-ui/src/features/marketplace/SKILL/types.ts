/**
 * ------------------------------------------------------------------
 * Skill Types
 * ------------------------------------------------------------------
 * Định nghĩa kiểu dữ liệu cho skill marketplace.
 *
 * Main types:
 * - SkillSummary : Thông tin tóm tắt skill (từ leaderboard/search)
 * - SkillDetail  : Thông tin chi tiết skill (từ detail API)
 * ------------------------------------------------------------------
 */

export interface SkillSummary {
  id: number;
  slug: string;
  name: string;
  author: string;
  description: string;
  sourceUrl?: string;
  category?: string;
  views: number;
  installs: number;
}

export interface SkillSearchResponse {
  skills: SkillSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface SkillDetail {
  name: string;
  description: string;
  content: string;
}