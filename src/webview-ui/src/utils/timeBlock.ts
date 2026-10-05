/**
 * ------------------------------------------------------------------
 * Time Block Utility (Zen Webview)
 * ------------------------------------------------------------------
 * Kiểm tra giờ hiện tại (UTC chuẩn) có nằm trong khung giờ bị cấm
 * dùng DeepSeek không.
 *
 * Khung giờ bị cấm (UTC):
 *   - 03:00–04:00 UTC  (= 10:00–11:00 GMT+7)
 *   - 19:00–21:00 UTC  (= 02:00–04:00 GMT+7 ngày hôm sau)
 *
 * NOTE: File này dùng cho Webview context (browser JS), không phải Node.js.
 * ------------------------------------------------------------------
 */

/**
 * Khung giờ bị chặn DeepSeek theo UTC chuẩn ([start, end) exclusive).
 */
const BLOCKED_RANGES: Array<{
  startUTC: number;
  endUTC: number;
  labelVN: string;
}> = [
  { startUTC: 3,  endUTC: 4,  labelVN: "10:00–11:00 (GMT+7)" },
  { startUTC: 19, endUTC: 21, labelVN: "02:00–04:00 (GMT+7)" },
];

/**
 * Lấy giờ UTC hiện tại (0–23).
 */
export function getCurrentUTCHour(): number {
  return new Date().getUTCHours();
}

/**
 * Kiểm tra giờ UTC hiện tại có bị chặn DeepSeek không.
 */
export function isDeepSeekBlockedNow(): boolean {
  const hour = getCurrentUTCHour();
  return BLOCKED_RANGES.some((r) => hour >= r.startUTC && hour < r.endUTC);
}

/**
 * Tên khung giờ (GMT+7) đang bị chặn, hoặc null nếu không bị chặn.
 */
export function getCurrentBlockedRangeLabel(): string | null {
  const hour = getCurrentUTCHour();
  const range = BLOCKED_RANGES.find((r) => hour >= r.startUTC && hour < r.endUTC);
  return range ? range.labelVN : null;
}

/**
 * Mô tả tất cả các khung giờ bị chặn (hiển thị GMT+7 cho user VN).
 */
export function getBlockedHourDescription(): string {
  return BLOCKED_RANGES.map((r) => r.labelVN).join(" và ");
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
