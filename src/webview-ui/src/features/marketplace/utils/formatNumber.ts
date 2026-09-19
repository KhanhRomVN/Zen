/**
 * Format số lượng lớn thành dạng rút gọn (1.2K, 3.4M).
 * Dùng cho views / installs trong skill card và detail.
 */
export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}