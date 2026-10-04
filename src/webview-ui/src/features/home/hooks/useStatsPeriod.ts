/**
 * ------------------------------------------------------------------
 * useStatsPeriod
 * ------------------------------------------------------------------
 * Hook quản lý period & offset cho stats dashboard.
 * Lưu lựa chọn vào extension storage để persist qua các lần mở.
 *
 * period: 'day' | 'week' | 'month' | 'year' | 'all'
 * offset: số nguyên >= 0 (0 = hiện tại, 1 = kỳ trước, ...)
 *   - day   : offset = số ngày trước (0 = today)
 *   - week  : offset = số tuần trước (0 = this week)
 *   - month : offset = số tháng trước (0 = this month)
 *   - year  : offset = số năm trước  (0 = this year)
 *   - all   : offset không dùng
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { extensionService } from "../../../services/ExtensionService";

// ─── Types ──────────────────────────────────────────────────────────────
export type StatsPeriod = "day" | "week" | "month" | "year" | "all";

export interface StatsPeriodState {
  period: StatsPeriod;
  offset: number;
}

const STORAGE_KEY = "home-stats-period";
const DEFAULT_STATE: StatsPeriodState = { period: "day", offset: 0 };

// ─── Hook ───────────────────────────────────────────────────────────────
export function useStatsPeriod() {
  const [state, setState] = useState<StatsPeriodState>(DEFAULT_STATE);
  const loadedRef = useRef(false);
  const storage = extensionService.getStorage();

  // Load from storage on mount
  useEffect(() => {
    storage
      .get(STORAGE_KEY)
      .then((res: any) => {
        if (res?.value) {
          try {
            const parsed = JSON.parse(res.value) as StatsPeriodState;
            if (parsed.period && typeof parsed.offset === "number") {
              setState(parsed);
            }
          } catch {
            // Ignore malformed value
          }
        }
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });
  }, []);

  // Persist whenever state changes (skip initial load)
  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state.period, state.offset]);

  const setPeriod = (period: StatsPeriod) => {
    setState({ period, offset: 0 });
  };

  const setOffset = (offset: number) => {
    setState((prev) => ({ ...prev, offset: Math.max(0, offset) }));
  };

  return { period: state.period, offset: state.offset, setPeriod, setOffset };
}
