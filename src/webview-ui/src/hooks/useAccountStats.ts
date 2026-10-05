/**
 * ------------------------------------------------------------------
 * useAccountStats
 * ------------------------------------------------------------------
 * Hook fetch live stats cho một account theo ID từ GET /v1/accounts/:id.
 * Trả về full FlatAccount bao gồm usage, period_tokens, period_requests.
 *
 * Tự động refetch mỗi khi accountId thay đổi.
 * Merge kết quả vào currentAccount qua setCurrentAccount để các
 * component khác (ChatHeader, triggerUI...) nhận được data mới nhất
 * mà không cần prop drilling.
 * ------------------------------------------------------------------
 */

import { useEffect, useRef } from "react";
import { useDbFetch } from "../services/useDbFetch";

interface UseAccountStatsOptions {
  /** ID của account cần fetch stats. Không fetch nếu null/undefined. */
  accountId: string | null | undefined;
  /** Callback nhận full account object từ API. */
  onStats: (account: any) => void;
  /** Interval tự động refetch (ms). Mặc định không refetch. */
  refreshInterval?: number;
}

export const useAccountStats = ({
  accountId,
  onStats,
  refreshInterval,
}: UseAccountStatsOptions): void => {
  const dbFetch = useDbFetch();
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  useEffect(() => {
    if (!accountId) return;

    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await dbFetch(`/v1/accounts/${accountId}`);
        if (cancelled) return;
        const result = await res.json();
        if (cancelled) return;
        if (result.success && result.data) {
          onStatsRef.current(result.data);
        }
      } catch {
        // silently ignore — ChatHeader vẫn hiển thị data cũ từ props
      }
    };

    fetchStats();

    if (refreshInterval && refreshInterval > 0) {
      const timer = setInterval(fetchStats, refreshInterval);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [accountId, dbFetch, refreshInterval]);
};
