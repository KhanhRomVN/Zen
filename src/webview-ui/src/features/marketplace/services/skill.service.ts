/**
 * ------------------------------------------------------------------
 * Skill Service
 * ------------------------------------------------------------------
 * Gọi 3 HTTP API từ mcp.directory thông qua extension host (Node.js)
 * để tránh CORS. Webview gửi postMessage → extension fetch → trả về.
 *
 * APIs:
 * - fetchLeaderboard()  : GET /skills (rsc:1) → parse initialSkills từ RSC
 * - searchSkills()      : GET /api/v1/skills?q=... → JSON thuần
 * - fetchSkillDetail()  : GET /skills/{slug} (rsc:1) → parse markdown từ RSC
 * ------------------------------------------------------------------
 */

import {
  SkillSummary,
  SkillSearchResponse,
  SkillDetail,
} from "../types/skill.types";
import {
  messageDispatcher,
  extensionService,
} from "../../../services/ExtensionService";

const REQUEST_TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface CacheEntry<T> {
  data: T;
  ts: number;
}

let leaderboardCache: CacheEntry<SkillSummary[]> | null = null;
const searchCache = new Map<string, CacheEntry<SkillSearchResponse>>();
const detailCache = new Map<string, CacheEntry<SkillDetail>>();

export const isCacheFresh = (entry: CacheEntry<unknown>): boolean =>
  Date.now() - entry.ts < CACHE_TTL_MS;
export const getCachedLeaderboard = () => leaderboardCache;
export const getCachedSearch = (query: string) =>
  searchCache.get(query) ?? null;
export const getCachedSkillDetail = (slug: string) =>
  detailCache.get(slug) ?? null;

/**
 * Gửi request đến extension host và chờ response.
 * Dùng messageDispatcher để map requestId → response.
 */
function fetchViaExtension(payload: {
  apiType: "leaderboard" | "search" | "detail";
  query?: string;
  slug?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = `fetchSkillAPI-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    messageDispatcher.register(
      requestId,
      (message: any) => {
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.data);
        }
      },
      REQUEST_TIMEOUT_MS,
      () => {
        console.error("fetchViaExtension: timeout", requestId);
        reject(
          new Error(`fetchSkillAPI timeout after ${REQUEST_TIMEOUT_MS}ms`),
        );
      },
    );

    extensionService.postMessage({
      command: "fetchSkillAPI",
      requestId,
      ...payload,
    });
  });
}

/**
 * API 1 — Leaderboard: lấy danh sách skill theo lượt xem.
 */
export async function fetchLeaderboard(): Promise<SkillSummary[]> {
  try {
    const skills = (await fetchViaExtension({
      apiType: "leaderboard",
    })) as SkillSummary[];
    if (!skills || skills.length === 0) {
      throw new Error("No skills returned from leaderboard");
    }
    leaderboardCache = { data: skills, ts: Date.now() };
    return skills;
  } catch (err: any) {
    console.error("fetchLeaderboard: ERROR", {
      name: err?.name,
      message: err?.message,
      cause: err?.cause,
    });
    throw err;
  }
}

/**
 * API 2 — Search: tìm kiếm skill theo query text.
 */
export async function searchSkills(
  query: string,
  limit: number = 24,
  offset: number = 0,
): Promise<SkillSearchResponse> {
  try {
    const data = (await fetchViaExtension({
      apiType: "search",
      query,
      limit,
      offset,
    })) as SkillSearchResponse;
    searchCache.set(query, { data, ts: Date.now() });
    return data;
  } catch (err: any) {
    console.error("searchSkills: ERROR", {
      name: err?.name,
      message: err?.message,
      cause: err?.cause,
    });
    throw err;
  }
}

/**
 * API 3 — Detail: lấy thông tin chi tiết của skill theo slug.
 */
export async function fetchSkillDetail(slug: string): Promise<SkillDetail> {
  try {
    const detail = (await fetchViaExtension({
      apiType: "detail",
      slug,
    })) as SkillDetail;
    if (!detail) {
      throw new Error(`No detail returned for "${slug}"`);
    }
    detailCache.set(slug, { data: detail, ts: Date.now() });
    return detail;
  } catch (err: any) {
    console.error("fetchSkillDetail: ERROR", {
      name: err?.name,
      message: err?.message,
      cause: err?.cause,
    });
    throw err;
  }
}