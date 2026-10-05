/**
 * ------------------------------------------------------------------
 * Timezone Utilities
 * ------------------------------------------------------------------
 * Cung cấp các helper để format thời gian theo timezone của người dùng.
 *
 * Cơ chế detect timezone:
 * 1. `Intl.DateTimeFormat().resolvedOptions().timeZone` — browser/WebView
 *    luôn trả về IANA timezone của hệ điều hành người dùng (ví dụ "Asia/Ho_Chi_Minh").
 * 2. Fallback về UTC offset string nếu Intl không có.
 *
 * Điều này đảm bảo Zen hiển thị đúng giờ địa phương của người dùng,
 * bất kể họ đang ở múi giờ nào.
 *
 * Main exports:
 * - getUserTimezone()        : Lấy IANA timezone của người dùng
 * - formatInUserTimezone()   : Format Date → "YYYY-MM-DD HH:mm" theo TZ người dùng
 * - parseIsoSafe()           : Parse ISO/SQLite string → Date UTC đúng
 * - computeNextResetVN()     : Tính thời điểm reset tiếp theo (00:00 GMT+7) ở frontend
 * ------------------------------------------------------------------
 */

// ─── Timezone Detection ──────────────────────────────────────────────────

/**
 * Lấy IANA timezone của người dùng từ browser/WebView.
 * Ví dụ: "Asia/Ho_Chi_Minh", "America/New_York", "Europe/Paris"
 * Fallback về UTC offset string nếu Intl không có.
 */
export function getUserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    // Intl không khả dụng — rất hiếm
  }
  // Fallback: tính offset từ JS
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

// ─── Format Helpers ──────────────────────────────────────────────────────

/**
 * Format một Date thành chuỗi "YYYY-MM-DD HH:mm" theo timezone của người dùng.
 * Nếu date không hợp lệ, trả về fallback hoặc "Invalid date".
 */
export function formatInUserTimezone(date: Date, fallback?: string): string {
  if (isNaN(date.getTime())) return fallback ?? 'Invalid date';
  try {
    const tz = getUserTimezone();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    // en-CA cho format "YYYY-MM-DD" natively
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  } catch {
    // Fallback nếu Intl.DateTimeFormat không hỗ trợ timeZone option
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
}

// ─── Parse Helpers ───────────────────────────────────────────────────────

/**
 * Parse ISO string hoặc SQLite string thành Date UTC đúng.
 *
 * Xử lý các format:
 * - ISO 8601 đầy đủ: "2026-10-05T17:00:00.000Z" → parse thẳng
 * - SQLite không có T/Z: "2026-10-05 17:00:00" → thêm T+Z (coi là UTC)
 * - Chỉ date: "2026-10-05" → 00:00:00 UTC
 *
 * Không bao giờ ném lỗi — trả về Invalid Date nếu không parse được.
 */
export function parseIsoSafe(raw: string): Date {
  if (!raw) return new Date(NaN);
  // Đã có T (ISO 8601) → parse thẳng
  if (raw.includes('T')) return new Date(raw);
  // SQLite "YYYY-MM-DD HH:MM:SS[.sss]" → thêm T và Z để parse UTC
  return new Date(raw.replace(' ', 'T') + 'Z');
}

// ─── Reset Calculation ───────────────────────────────────────────────────

/**
 * Tính thời điểm reset tiếp theo theo boundary GMT+7, dùng ở frontend.
 * Giống logic backend computeResetAt — luôn lấy 00:00 GMT+7 của kỳ tiếp theo.
 *
 * - 'day'   : 00:00 GMT+7 ngày hôm sau
 * - 'week'  : thứ Hai 00:00 GMT+7 tuần tới
 * - 'month' : ngày 1 tháng tới 00:00 GMT+7
 *
 * Dùng khi `reset_usage_at` từ DB đã expired hoặc là data cũ (UTC midnight),
 * cần tính lại thời điểm reset đúng để hiển thị.
 */
export function computeNextResetVN(period: 'day' | 'week' | 'month' = 'day'): Date {
  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
  const now = new Date();
  // "Giờ GMT+7" = dịch now sang UTC+7 view
  const localDate = new Date(now.getTime() + TZ_OFFSET_MS);

  if (period === 'day') {
    return new Date(
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        localDate.getUTCDate() + 1,
        0, 0, 0, 0,
      ) - TZ_OFFSET_MS,
    );
  }
  if (period === 'week') {
    const dow = localDate.getUTCDay(); // 0=Sun
    const daysUntilMonday = dow === 0 ? 1 : 8 - dow;
    return new Date(
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        localDate.getUTCDate() + daysUntilMonday,
        0, 0, 0, 0,
      ) - TZ_OFFSET_MS,
    );
  }
  // month
  return new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      1, 0, 0, 0, 0,
    ) - TZ_OFFSET_MS,
  );
}
