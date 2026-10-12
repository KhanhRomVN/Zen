/**
 * ------------------------------------------------------------------
 * useConversationInsights
 * ------------------------------------------------------------------
 * Thống kê hoạt động của hội thoại hiện tại từ các message đã parse,
 * dùng cho right sidebar của Chat.
 *
 * Main features:
 * - Files changed: gom write_to_file / replace_in_file / delete_file theo path,
 *   cộng dòng thêm/xóa, file vừa được chạm xếp trước
 * - Tool activity: đếm số lần gọi và số lần lỗi theo từng tool
 * - Mốc thời gian đầu/cuối và số lượt hỏi của user
 * - Kết quả phân tích từng message được cache theo object `parsed`
 *   (WeakMap) nên khi streaming chỉ message đang stream phải tính lại
 *
 * Lưu ý: số liệu dựa trên các action AI đã đề xuất trong message, chưa
 * phân biệt action bị user từ chối với action đã thực thi thành công.
 *
 * Main functions:
 * - useConversationInsights() : Trả về ConversationInsights
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useMemo } from "react";

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  /** Số lần tool chạm vào file này. */
  edits: number;
  /** Thao tác cuối cùng lên file là xóa. */
  deleted: boolean;
}

export interface ToolStat {
  type: string;
  count: number;
  errors: number;
}

export interface ConversationInsights {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  tools: ToolStat[];
  totalToolCalls: number;
  totalErrors: number;
  userTurns: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

interface FileOp {
  path: string;
  additions: number;
  deletions: number;
  deleted: boolean;
}

interface MessageInsight {
  files: FileOp[];
  tools: Array<{ type: string; error: boolean }>;
}

// ─── Constants ──────────────────────────────────────────────────────────
/** Các type không phải tool thật nên không tính vào Tool activity. */
const IGNORED_TYPES = new Set([
  "conversation_title",
  "markdown",
  "code",
  "question",
  "thinking",
]);

// WeakMap theo object parsed: message đã xong dùng lại kết quả, message đang
// stream có parsed mới mỗi lần nên tự tính lại.
const messageCache = new WeakMap<object, MessageInsight>();

// ─── Helpers ────────────────────────────────────────────────────────────
const countLines = (s: unknown): number =>
  typeof s === "string" && s.length > 0 ? s.split("\n").length : 0;

/** Phân tích các action của một message assistant (có cache). */
function analyze(parsed: any): MessageInsight {
  const cached = messageCache.get(parsed);
  if (cached) return cached;

  const out: MessageInsight = { files: [], tools: [] };
  for (const a of parsed.actions ?? []) {
    if (!a?.type || IGNORED_TYPES.has(a.type)) continue;
    const isError = !!a.isError || !!a.params?._validationError;
    out.tools.push({ type: a.type, error: isError });
    if (isError) continue;

    const path: string | undefined = a.params?.file_path ?? a.params?.path;
    if (!path) continue;

    if (a.type === "write_to_file") {
      out.files.push({
        path,
        additions: countLines(a.params.content),
        deletions: 0,
        deleted: false,
      });
    } else if (a.type === "replace_in_file") {
      out.files.push({
        path,
        additions: countLines(a.params.new_content),
        deletions: countLines(a.params.old_content),
        deleted: false,
      });
    } else if (a.type === "delete_file") {
      out.files.push({ path, additions: 0, deletions: 0, deleted: true });
    }
  }

  messageCache.set(parsed, out);
  return out;
}

// ─── Hook ───────────────────────────────────────────────────────────────
/** Truyền vào parsedMessages (message đã có trường `parsed`). */
export function useConversationInsights(
  messages: any[],
): ConversationInsights {
  return useMemo(() => {
    const fileMap = new Map<string, FileChange>();
    const toolMap = new Map<string, ToolStat>();
    let userTurns = 0;
    let first = 0;
    let last = 0;
    let totalErrors = 0;
    let totalToolCalls = 0;

    for (const m of messages) {
      if (m.uiHidden || m.isCancelled) continue;
      if (m.role === "user") userTurns++;
      if (m.timestamp) {
        first = first ? Math.min(first, m.timestamp) : m.timestamp;
        last = Math.max(last, m.timestamp);
      }
      if (m.role !== "assistant" || !m.parsed) continue;

      const insight = analyze(m.parsed);

      for (const t of insight.tools) {
        const stat = toolMap.get(t.type) ?? {
          type: t.type,
          count: 0,
          errors: 0,
        };
        stat.count++;
        totalToolCalls++;
        if (t.error) {
          stat.errors++;
          totalErrors++;
        }
        toolMap.set(t.type, stat);
      }

      for (const f of insight.files) {
        const prev = fileMap.get(f.path);
        // delete + set để file vừa được chạm nằm cuối Map (đảo ngược ở cuối)
        fileMap.delete(f.path);
        fileMap.set(f.path, {
          path: f.path,
          additions: (prev?.additions ?? 0) + f.additions,
          deletions: (prev?.deletions ?? 0) + f.deletions,
          edits: (prev?.edits ?? 0) + 1,
          deleted: f.deleted,
        });
      }
    }

    const files = [...fileMap.values()].reverse();
    return {
      files,
      totalAdditions: files.reduce((s, f) => s + f.additions, 0),
      totalDeletions: files.reduce((s, f) => s + f.deletions, 0),
      tools: [...toolMap.values()].sort((a, b) => b.count - a.count),
      totalToolCalls,
      totalErrors,
      userTurns,
      firstTimestamp: first,
      lastTimestamp: last,
    };
  }, [messages]);
}