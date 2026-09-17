/**
 * ------------------------------------------------------------------
 * Relative Time
 * ------------------------------------------------------------------
 * Format timestamp (ms) thành chuỗi tương đối kiểu "20 minutes ago",
 * "1 day ago". Dùng cho hiển thị lần dùng gần nhất của account.
 * ------------------------------------------------------------------
 */

/**
 * Trả về chuỗi tương đối như "20 minutes ago", hoặc null nếu input rỗng.
 */
export function formatRelativeTime(
  ts: number | null | undefined,
  now: number = Date.now(),
): string | null {
  if (ts == null || !Number.isFinite(ts)) return null;
  const diff = now - ts;
  if (diff < 0) return "just now";

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min !== 1 ? "s" : ""} ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr !== 1 ? "s" : ""} ago`;

  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day !== 1 ? "s" : ""} ago`;

  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} month${mon !== 1 ? "s" : ""} ago`;

  const yr = Math.floor(mon / 12);
  return `${yr} year${yr !== 1 ? "s" : ""} ago`;
}