/**
 * ------------------------------------------------------------------
 * Skill API Handler
 * ------------------------------------------------------------------
 * Xử lý fetch 3 API từ mcp.directory trên extension host (Node.js)
 * để tránh CORS khi webview gọi trực tiếp.
 *
 * APIs:
 * - leaderboard : GET /skills (rsc:1) → parse initialSkills từ RSC
 * - search      : GET /api/v1/skills?q=... → JSON thuần
 * - detail      : GET /skills/{slug} (rsc:1) → parse markdown từ RSC
 * ------------------------------------------------------------------
 */

import * as vscode from "vscode";

const BASE_URL = "https://mcp.directory";

interface SkillSummary {
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

interface SkillDetail {
  name: string;
  description: string;
  content: string;
}

function parseLeaderboardRSC(text: string): SkillSummary[] {
  try {
    const match = text.match(/"initialSkills"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/);
    if (!match) return [];
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? (parsed as SkillSummary[]) : [];
  } catch (err: any) {
    console.error("[SkillAPIHandler] parse leaderboard error:", err.message);
    return [];
  }
}

function parseSkillDetailFallback(text: string): SkillDetail | null {
  try {
    const patterns = [
      /"name":"([^"]+)","author":"[^"]+","description":"((?:[^"\\]|\\.)*)"/,
      /\\"name\\":\\"([^\\]+)\\",\\"author\\":\\"[^\\]+\\",\\"description\\":\\"((?:[^\\"]|\\.)*?)\\/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        const description = match[2]
          .replace(/\\\"/g, '"')
          .replace(/\\\\/g, "\\")
          .replace(/\\n/g, "\n");
        console.log(
          `[SkillAPIHandler] fallback detail: name="${name}", description length ${description.length}`,
        );
        return { name, description, content: description };
      }
    }
    return null;
  } catch (err: any) {
    console.error("[SkillAPIHandler] fallback parse error:", err.message);
    return null;
  }
}

function parseSkillDetailRSC(text: string): SkillDetail | null {
  try {
    // 1. Tìm block "T<number>,---\n" — bắt đầu markdown block
    const blockMatch = text.match(/T\d+,---\n/);
    if (!blockMatch || blockMatch.index === undefined) {
      console.log(
        "[SkillAPIHandler] Không tìm thấy block T<number>---, dùng fallback JSON",
      );
      return parseSkillDetailFallback(text);
    }
    const blockStart = blockMatch.index;
    const blockHeader = blockMatch[0];
    const frontmatterStart = blockStart + blockHeader.length;

    // 2. Tìm frontmatter close: "\n---\n" (dấu --- đứng riêng trên dòng)
    const frontmatterClose = text.indexOf("\n---\n", frontmatterStart);
    if (frontmatterClose === -1) {
      console.log(
        "[SkillAPIHandler] Không tìm thấy frontmatter close, dùng fallback JSON",
      );
      return parseSkillDetailFallback(text);
    }

    // 3. Parse frontmatter
    const frontmatter = text.substring(frontmatterStart, frontmatterClose);
    const nameMatch = frontmatter.match(/name:\s*(.+?)(?:\n|$)/);
    const descMatch = frontmatter.match(/description:\s*(.+?)(?:\n|$)/);
    if (!nameMatch) {
      console.log(
        "[SkillAPIHandler] Không tìm thấy name trong frontmatter, dùng fallback JSON",
      );
      return parseSkillDetailFallback(text);
    }
    const name = nameMatch[1].trim();
    const description = descMatch?.[1]?.trim() || "";

    // 4. Markdown content bắt đầu sau "\n---\n" (5 ký tự)
    const contentStart = frontmatterClose + 5;

    // 5. Tìm block RSC tiếp theo: "\n[0-9a-f]+:" + type char
    const remaining = text.substring(contentStart);
    const nextBlockMatch = remaining.match(/\n[0-9a-f]+:(?:[A-Z]|[{$\"\\[])/);
    const contentEnd =
      nextBlockMatch && nextBlockMatch.index !== undefined
        ? contentStart + nextBlockMatch.index + 1
        : text.length;

    const content = text.substring(contentStart, contentEnd).trim();

    console.log(
      `[SkillAPIHandler] parse detail: content length ${content.length}`,
    );

    return { name, description, content };
  } catch (err: any) {
    console.error("[SkillAPIHandler] parse detail error:", err.message);
    return null;
  }
}

export class SkillAPIHandler {
  public async handleFetchSkillAPI(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { requestId, apiType } = message;

    try {
      let data: any;

      switch (apiType) {
        case "leaderboard": {
          console.log("[SkillAPIHandler] fetching leaderboard...");
          const response = await fetch(`${BASE_URL}/skills`, {
            method: "GET",
            headers: { rsc: "1" },
          });
          if (!response.ok) {
            throw new Error(`Leaderboard request failed: ${response.status}`);
          }
          const text = await response.text();
          const skills = parseLeaderboardRSC(text);
          if (skills.length === 0) {
            throw new Error("Failed to parse leaderboard response");
          }
          console.log(`[SkillAPIHandler] leaderboard: ${skills.length} skills`);
          data = skills;
          break;
        }

        case "search": {
          const { query, limit = 24, offset = 0 } = message;
          const params = new URLSearchParams({
            q: query,
            limit: String(limit),
            offset: String(offset),
          });
          console.log(`[SkillAPIHandler] searching: "${query}"`);
          const response = await fetch(`${BASE_URL}/api/v1/skills?${params}`, {
            method: "GET",
          });
          if (!response.ok) {
            throw new Error(`Search request failed: ${response.status}`);
          }
          data = await response.json();
          console.log(
            `[SkillAPIHandler] search: ${data.skills?.length ?? 0} results`,
          );
          break;
        }

        case "detail": {
          const { slug } = message;
          console.log(`[SkillAPIHandler] fetching detail: "${slug}"`);
          const response = await fetch(`${BASE_URL}/skills/${slug}`, {
            method: "GET",
            headers: { rsc: "1" },
          });
          if (!response.ok) {
            throw new Error(`Detail request failed: ${response.status}`);
          }
          const text = await response.text();
          const detail = parseSkillDetailRSC(text);
          if (!detail) {
            throw new Error(`Failed to parse detail for "${slug}"`);
          }
          console.log(
            `[SkillAPIHandler] detail: "${detail.name}" (${detail.content.length} chars)`,
          );
          data = detail;
          break;
        }

        default:
          throw new Error(`Unknown apiType: ${apiType}`);
      }

      webviewView.webview.postMessage({
        command: "fetchSkillAPIResponse",
        requestId,
        data,
      });
    } catch (err: any) {
      console.error("[SkillAPIHandler] error:", err.message);
      webviewView.webview.postMessage({
        command: "fetchSkillAPIResponse",
        requestId,
        error: err.message || "Failed to fetch skill API",
      });
    }
  }
}