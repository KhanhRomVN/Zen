/**
 * ------------------------------------------------------------------
 * Time Block Utility (Zen extension host)
 * ------------------------------------------------------------------
 * Kiểm tra giờ UTC chuẩn có nằm trong khung giờ bị cấm DeepSeek không.
 *
 * Khung giờ bị cấm (UTC):
 *   - 03:00–04:00 UTC  (= 10:00–11:00 GMT+7)
 *   - 19:00–21:00 UTC  (= 02:00–04:00 GMT+7 ngày hôm sau)
 *
 * Label hiển thị theo UTC vì extension host không biết timezone của user.
 * ------------------------------------------------------------------
 */

const BLOCKED_RANGES: Array<{
  startTime: number;
  endTime: number;
}> = [
  { startTime: 3,  endTime: 4  },
  { startTime: 19, endTime: 21 },
];

const fmtUTC = (h: number): string => `${String(h).padStart(2, "0")}:00 UTC`;

export function getCurrentUTCHour(): number {
  return new Date().getUTCHours();
}

export function isDeepSeekBlockedNow(): boolean {
  const hour = getCurrentUTCHour();
  return BLOCKED_RANGES.some((r) => hour >= r.startTime && hour < r.endTime);
}

export function getCurrentBlockedRangeLabel(): string | null {
  const hour = getCurrentUTCHour();
  const range = BLOCKED_RANGES.find((r) => hour >= r.startTime && hour < r.endTime);
  return range ? `${fmtUTC(range.startTime)}–${fmtUTC(range.endTime)}` : null;
}

export function getBlockedHourDescription(): string {
  return BLOCKED_RANGES.map((r) => `${fmtUTC(r.startTime)}–${fmtUTC(r.endTime)}`).join(" và ");
}

export function isDeepSeekProvider(
  providerId: string | undefined | null,
): boolean {
  if (!providerId) return false;
  return providerId.toLowerCase().includes("deepseek");
}
