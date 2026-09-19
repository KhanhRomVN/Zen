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
 * - detail      : GET /skills/{slug} (rsc:1) → parse skill object + markdown từ RSC
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

/**
 * Chuẩn hoá giá trị placeholder của RSC.
 * RSC dùng "$undefined" cho field undefined — convert về undefined thật.
 */
function normalizeRSCValue(value: any): any {
  if (value === "$undefined" || value === "$null") return undefined;
  return value;
}

/**
 * Trích nội dung markdown của SKILL.md từ RSC payload dựa vào lazy reference.
 *
 * Cấu trúc block trong payload:
 *   <blockId>:T<hex>,---\n
 *   name: <skill-name>\n
 *   description: <desc>\n
 *   ---\n
 *   <markdown content>
 *   \n<nextBlockId>:<char>...   ← ranh giới block kế tiếp
 *
 * @param text   Full RSC payload
 * @param ref    Lazy reference dạng "$31" (trỏ tới block ID 31)
 * @returns      Phần markdown body (đã strip frontmatter), hoặc "" nếu không tìm thấy
 */
function extractContentByRef(text: string, ref: string): string {
  // ref dạng "$31" → blockId = "31"
  const refMatch = ref.match(/^\$([0-9a-f]+)$/i);
  if (!refMatch) return "";
  const blockId = refMatch[1];

  // Tìm header block: "<blockId>:T<hex>,---\n".
  // Lưu ý: block có thể nối liền sau '}' (vd: "}31:T10e4,---"), nên KHÔNG
  // dùng (?:\n|^) mà dùng [^0-9a-f] để tránh bắt nhầm suffix như "a31:".
  const headerRe = new RegExp(
    `(?:^|[^0-9a-f])${blockId}:T[0-9a-f]+,---\\n`,
    "i",
  );
  const headerMatch = text.match(headerRe);
  if (!headerMatch || headerMatch.index === undefined) return "";

  const bodyStart = headerMatch.index + headerMatch[0].length;

  // Tìm dòng đóng frontmatter: "\n---\n"
  const frontmatterClose = text.indexOf("\n---\n", bodyStart);
  if (frontmatterClose === -1) return "";

  const contentStart = frontmatterClose + 5; // bỏ "\n---\n"

  // Tìm block kế tiếp: "\n<hex>:[A-Za-z{[\"$]"
  const remaining = text.substring(contentStart);
  const nextBlock = remaining.match(/\n[0-9a-f]+:[A-Za-z{["$]/i);
  const contentEnd =
    nextBlock && nextBlock.index !== undefined
      ? contentStart + nextBlock.index
      : text.length;

  return text.substring(contentStart, contentEnd).trim();
}

/**
 * Fallback regex khi không parse được object skill từ RSC payload.
 * Giữ lại để tránh vỡ hoàn toàn nếu format RSC thay đổi.
 */
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
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
          .replace(/\\n/g, "\n");

        return { name, description, content: description };
      }
    }
    return null;
  } catch (err: any) {
    console.error("[SkillAPIHandler] fallback parse error:", err.message);
    return null;
  }
}

/**
 * Parse skill detail từ RSC payload.
 *
 * Chiến lược:
 * 1. Trích object "skill":{...} đầy đủ metadata (id, slug, author, views, installs, ...).
 * 2. Đọc lazy ref trong field "content" (dạng "$31") → trỏ tới block markdown.
 * 3. Trích markdown body của block đó.
 * 4. Fallback về regex nếu bước 1-3 thất bại.
 */
function parseSkillDetailRSC(text: string): SkillDetail | null {
  try {
    // Bước 1: tìm object skill đầy đủ
    const skillMatch = text.match(
      /"skill":(\{"id":[\s\S]*?\}),"relatedSkills"/,
    );
    if (!skillMatch) {
      console.warn(
        "[SkillAPIHandler] no \"skill\":{...} block found, using fallback",
      );
      return parseSkillDetailFallback(text);
    }

    let skill: any;
    try {
      skill = JSON.parse(skillMatch[1]);
    } catch (err: any) {
      console.error(
        "[SkillAPIHandler] JSON.parse skill object failed:",
        err.message,
      );
      return parseSkillDetailFallback(text);
    }

    // Bước 2 + 3: trích markdown content qua lazy ref
    let content = "";
    if (typeof skill.content === "string") {
      content = extractContentByRef(text, skill.content);
    }

    // Bước 4: build kết quả, normalize placeholder RSC
    const detail: SkillDetail = {
      id: skill.id,
      slug: skill.slug,
      name: skill.name || skill.slug || "Unknown",
      author: skill.author,
      description: skill.description || "",
      seoDescription: normalizeRSCValue(skill.seoDescription),
      sourceUrl: skill.sourceUrl,
      category: skill.category || undefined,
      views: typeof skill.views === "number" ? skill.views : undefined,
      installs: typeof skill.installs === "number" ? skill.installs : undefined,
      content,
    };

    // Nếu không extract được content, fallback để ít nhất có description
    if (!content) {
      console.warn(
        "[SkillAPIHandler] empty content extracted, fallback for markdown body",
      );
      const fallback = parseSkillDetailFallback(text);
      if (fallback?.content) detail.content = fallback.content;
    }

    return detail;
  } catch (err: any) {
    console.error("[SkillAPIHandler] parse detail error:", err.message);
    return parseSkillDetailFallback(text);
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
          const response = await fetch(`${BASE_URL}/api/v1/skills?${params}`, {
            method: "GET",
          });
          if (!response.ok) {
            throw new Error(`Search request failed: ${response.status}`);
          }
          data = await response.json();
          break;
        }

        case "detail": {
          const { slug } = message;
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