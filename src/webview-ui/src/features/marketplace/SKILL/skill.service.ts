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

import { SkillSummary, SkillSearchResponse, SkillDetail } from "./types";
import {
  messageDispatcher,
  extensionService,
} from "../../../services/ExtensionService";

const REQUEST_TIMEOUT_MS = 15000;

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

    console.log("[DEBUG] fetchViaExtension: sending", {
      requestId,
      ...payload,
    });

    messageDispatcher.register(
      requestId,
      (message: any) => {
        console.log("[DEBUG] fetchViaExtension: response", {
          requestId,
          hasData: !!message.data,
          hasError: !!message.error,
          error: message.error,
        });
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.data);
        }
      },
      REQUEST_TIMEOUT_MS,
      () => {
        console.error("[DEBUG] fetchViaExtension: timeout", requestId);
        reject(new Error(`fetchSkillAPI timeout after ${REQUEST_TIMEOUT_MS}ms`));
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
  console.log("[DEBUG] fetchLeaderboard: calling via extension");
  try {
    const skills = (await fetchViaExtension({
      apiType: "leaderboard",
    })) as SkillSummary[];
    console.log("[DEBUG] fetchLeaderboard: got", skills.length, "skills");
    if (!skills || skills.length === 0) {
      throw new Error("No skills returned from leaderboard");
    }
    return skills;
  } catch (err: any) {
    console.error("[DEBUG] fetchLeaderboard: ERROR", {
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
  console.log("[DEBUG] searchSkills: calling via extension", { query, limit, offset });
  try {
    const data = (await fetchViaExtension({
      apiType: "search",
      query,
      limit,
      offset,
    })) as SkillSearchResponse;
    console.log("[DEBUG] searchSkills: got", data.skills?.length, "results");
    return data;
  } catch (err: any) {
    console.error("[DEBUG] searchSkills: ERROR", {
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
  console.log("[DEBUG] fetchSkillDetail: calling via extension", { slug });
  try {
    const detail = (await fetchViaExtension({
      apiType: "detail",
      slug,
    })) as SkillDetail;
    console.log("[DEBUG] fetchSkillDetail: got", {
      name: detail?.name,
      description: detail?.description,
      contentLength: detail?.content?.length,
    });
    if (!detail) {
      throw new Error(`No detail returned for "${slug}"`);
    }
    return detail;
  } catch (err: any) {
    console.error("[DEBUG] fetchSkillDetail: ERROR", {
      name: err?.name,
      message: err?.message,
      cause: err?.cause,
    });
    throw err;
  }
}