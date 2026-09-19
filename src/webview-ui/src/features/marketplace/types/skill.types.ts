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

/**
 * SkillDetail — đồng bộ 1-1 với interface trong extension host
 * (`src/handlers/tool/SkillAPIHandler.ts`). Mọi field metadata được trả về
 * từ RSC skill object, riêng `content` được trích từ block markdown lazy-ref.
 */
export interface SkillDetail {
  id?: number;
  slug?: string;
  name: string;
  author?: string;
  description: string;
  seoDescription?: string;
  sourceUrl?: string;
  category?: string;
  views?: number;
  installs?: number;
  content: string;
}