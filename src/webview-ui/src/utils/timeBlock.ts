/**
 * ------------------------------------------------------------------
 * Time Block Utility (Zen Webview)
 * ------------------------------------------------------------------
 * Kiểm tra giờ UTC có nằm trong khung giờ bị cấm DeepSeek không.
 *
 * Ranges KHÔNG hardcode nữa — lấy từ provider config trả về qua
 * `/v1/providers` (field `blocked_time_ranges`). Khi đổi
 * deepseek.constant.ts phía AIWeb2API, Zen tự sync không cần sửa thêm.
 *
 * Fallback: nếu chưa load được provider, dùng DEFAULT_BLOCKED_RANGES
 * để tránh bỏ sót chặn khi app vừa khởi động.
 *
 * NOTE: File này dùng cho Webview context (browser JS), không phải Node.js.
 * ------------------------------------------------------------------
 */

export type BlockedTimeRange = { startTime: number; endTime: number };

/**
 * Fallback khi chưa fetch được provider config.
 * Khớp với deepseek.constant.ts — CHỈ dùng khi provider chưa load.
 */
const DEFAULT_BLOCKED_RANGES: BlockedTimeRange[] = [
  { startTime: 3, endTime: 4 },
  { startTime: 19, endTime: 21 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Lấy giờ UTC hiện tại (0–23).
 */
export function getCurrentUTCHour(): number {
  return new Date().getUTCHours();
}

/**
 * Đổi giờ UTC (0–24) sang Date local, dựa trên ngày hôm nay UTC.
 * utcHour=24 được chuẩn hoá thành 0:00 ngày hôm sau UTC.
 */
function utcHourToLocalDate(utcHour: number): Date {
  const now = new Date();
  // Lấy ngày hôm nay UTC (bỏ phần giờ/phút/giây)
  const base = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(base + utcHour * 3_600_000);
}

/** Format Date → "HH:MM" theo local timezone */
function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Format Date → "dd/mm" theo local timezone */
function fmtDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

/**
 * Tạo label local cho 1 range, xử lý trường hợp wrap qua nửa đêm.
 *
 * Same-day  (08:00–11:00):            "08:00–11:00"
 * Next-day  (02:00–04:00 ngày sau):   "02:00–04:00 (next day)"
 * Cross-month / khác ngày rõ ràng:    "HH:MM dd/mm – HH:MM dd/mm"
 */
function buildRangeLabel(range: BlockedTimeRange): string {
  const startDate = utcHourToLocalDate(range.startTime);
  const endDate = utcHourToLocalDate(range.endTime);

  const startTime = fmtTime(startDate);
  const endTime = fmtTime(endDate);

  // So sánh ngày local (year+month+day)
  const startDay =
    startDate.getFullYear() * 10000 +
    startDate.getMonth() * 100 +
    startDate.getDate();
  const endDay =
    endDate.getFullYear() * 10000 +
    endDate.getMonth() * 100 +
    endDate.getDate();

  if (startDay === endDay) {
    // Same local day — chỉ hiện giờ
    return `${startTime}–${endTime}`;
  }

  // endDate là ngày hôm sau startDate (chênh đúng 1 ngày) → "next day"
  const diffDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / 86_400_000,
  );
  if (diffDays === 1) {
    return `${startTime}–${endTime} (next day)`;
  }

  // Khoảng cách > 1 ngày → hiện đầy đủ ngày/giờ
  return `${startTime} ${fmtDate(startDate)}–${endTime} ${fmtDate(endDate)}`;
}

// ─── Core API (nhận ranges từ ngoài) ─────────────────────────────────────

/**
 * Kiểm tra giờ UTC hiện tại có nằm trong bất kỳ range nào không.
 * @param ranges - lấy từ `provider.blocked_time_ranges`, fallback về DEFAULT nếu null/undefined
 */
export function isBlockedNow(
  ranges: BlockedTimeRange[] | null | undefined,
): boolean {
  const r = ranges ?? DEFAULT_BLOCKED_RANGES;
  const hour = getCurrentUTCHour();
  const blocked = r.some(
    (range) => hour >= range.startTime && hour < range.endTime,
  );
  return blocked;
}

/**
 * Label local của range đang bị chặn, hoặc null nếu không bị chặn.
 */
export function getBlockedRangeLabel(
  ranges: BlockedTimeRange[] | null | undefined,
): string | null {
  const r = ranges ?? DEFAULT_BLOCKED_RANGES;
  const hour = getCurrentUTCHour();
  const range = r.find(
    (range) => hour >= range.startTime && hour < range.endTime,
  );
  const label = range ? buildRangeLabel(range) : null;
  return label;
}

/**
 * Mô tả tất cả ranges bị chặn (local timezone).
 */
export function getBlockedHoursDescription(
  ranges: BlockedTimeRange[] | null | undefined,
): string {
  const r = ranges ?? DEFAULT_BLOCKED_RANGES;
  const desc = r.map(buildRangeLabel).join(" and ");
  return desc;
}

// ─── Compat wrappers (dùng DEFAULT — chỉ cho code chưa có provider) ──────

/**
 * @deprecated Dùng `isBlockedNow(provider.blocked_time_ranges)` thay thế.
 * Giữ lại để không break code cũ trong lúc migration.
 */
export function isDeepSeekBlockedNow(): boolean {
  return isBlockedNow(DEFAULT_BLOCKED_RANGES);
}

/** @deprecated Dùng `getBlockedRangeLabel(provider.blocked_time_ranges)` */
export function getCurrentBlockedRangeLabel(): string | null {
  return getBlockedRangeLabel(DEFAULT_BLOCKED_RANGES);
}

/** @deprecated Dùng `getBlockedHoursDescription(provider.blocked_time_ranges)` */
export function getBlockedHourDescription(): string {
  return getBlockedHoursDescription(DEFAULT_BLOCKED_RANGES);
}

/**
 * Kiểm tra provider có phải DeepSeek không.
 */
export function isDeepSeekProvider(
  providerId: string | undefined | null,
): boolean {
  if (!providerId) return false;
  return providerId.toLowerCase().includes("deepseek");
}
