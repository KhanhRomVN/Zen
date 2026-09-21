/**
 * useActiveDatabaseManagerName
 *
 * Trả về tên của database manager đang active (activeDatabaseManagerId).
 * Fetch từ /v1/database-managers, cache kết quả theo apiUrl.
 * Trả về null khi chưa có active manager hoặc đang fetch.
 */

import { useState, useEffect } from "react";
import { useSettings } from "../context/SettingsContext";

export const useActiveDatabaseManagerName = (): string | null => {
  const { apiUrl, activeDatabaseManagerId } = useSettings();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDatabaseManagerId) {
      setName(null);
      return;
    }

    let cancelled = false;
    const headers: Record<string, string> = {
      "x-database-manager-id": activeDatabaseManagerId,
    };

    fetch(`${apiUrl}/v1/database-managers`, { headers })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        const managers: any[] = result?.success && Array.isArray(result.data)
          ? result.data
          : [];
        const found = managers.find(
          (m: any) => String(m.id) === String(activeDatabaseManagerId),
        );
        setName(found?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [apiUrl, activeDatabaseManagerId]);

  return name;
};
