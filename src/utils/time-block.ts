/**
 * ------------------------------------------------------------------
 * Time Block Utility (Zen extension host)
 * ------------------------------------------------------------------
 * Kiểm tra giờ UTC chuẩn có nằm trong khung giờ bị cấm DeepSeek không.
 *
 * Khung giờ bị cấm (UTC):
 *   - 03:00–04:00 UTC  (= 10:00–11:00 GMT+7)
 *   - 19:00–21:00 UTC  (= 02:00–04:00 GMT+7 ngày hôm sau)
 * ------------------------------------------------------------------
 */

const BLOCKED_RANGES: Array<{
  startUTC: number;
  endUTC: number;
  labelVN: string;
}> = [
  { startUTC: 3,  endUTC: 4,  labelVN: "10:00–11:00 (GMT+7)" },
  { startUTC: 19, endUTC: 21, labelVN: "02:00–04:00 (GMT+7)" },
];

export function getCurrentUTCHour(): number {
  return new Date().getUTCHours();
}

export function isDeepSeekBlockedNow(): boolean {
  const hour = getCurrentUTCHour();
  return BLOCKED_RANGES.some((r) => hour >= r.startUTC && hour < r.endUTC);
}

export function getCurrentBlockedRangeLabel(): string | null {
  const hour = getCurrentUTCHour();
  const range = BLOCKED_RANGES.find((r) => hour >= r.startUTC && hour < r.endUTC);
  return range ? range.labelVN : null;
}

export function getBlockedHourDescription(): string {
  return BLOCKED_RANGES.map((r) => r.labelVN).join(" và ");
}

export function isDeepSeekProvider(
  providerId: string | undefined | null,
): boolean {
  if (!providerId) return false;
  return providerId.toLowerCase().includes("deepseek");
}
