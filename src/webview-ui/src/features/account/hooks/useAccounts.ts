/**
 * ------------------------------------------------------------------
 * useAccounts
 * ------------------------------------------------------------------
 * Custom hook quản lý toàn bộ state và thao tác cho danh sách tài khoản.
 * Xử lý fetch, filter, delete, chuyển đổi tài khoản CLI.

 * Main features:
 * - Fetch danh sách tài khoản kèm thống kê daily requests/tokens
 * - Tìm kiếm theo email và lọc theo provider
 * - Xóa đơn lẻ hoặc hàng loạt (bulk delete)
 * - Chuyển đổi tài khoản đang hoạt động trên CLI
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import { useState, useEffect, useCallback, useRef } from "react";

// ── Hooks ──
import { useSettings } from "../../../context/SettingsContext";

// ── Types ──
import { FlatAccount, Pagination } from "../types";

// ─── Hook ───────────────────────────────────────────────────────────────
export const useAccounts = (isOpen: boolean) => {
  // ── State ──
  const [accounts, setAccounts] = useState<FlatAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<FlatAccount[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [statsPeriod, setStatsPeriod] = useState<"day" | "week" | "month">("day");
  const [emailFilter, setEmailFilter] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    total_pages: 1,
  });
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(
    new Set(),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    email?: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Store ──
  const { apiUrl } = useSettings();
  const abortRef = useRef<AbortController | null>(null);

  // ── Callbacks ──
  const callBackend = useCallback(
    async (
      endpoint: string,
      method: string = "GET",
      body?: any,
      signal?: AbortSignal,
    ) => {
      const url = `${apiUrl}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
        cache: "no-store", // Prevent caching
        signal,
      };
      if (body) options.body = JSON.stringify(body);
      try {
        const response = await fetch(url, options);
        return await response.json();
      } catch (err: any) {
        if (err.name === "AbortError" || signal?.aborted) {
          return { aborted: true };
        }
        throw err;
      }
    },
    [apiUrl],
  );

  const fetchAccounts = useCallback(
    async (page = 1, limit = 20, silent = false) => {
      if (!isOpen) return;

      // Abort previous in-flight requests when a new search/filter fetch starts
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      if (!silent) setLoading(true);
      try {
        // Fetch providers first if empty
        if (providerConfigs.length === 0) {
          try {
            const pResult = await callBackend("/v1/providers", "GET", undefined, signal);
            if (pResult?.aborted || signal.aborted) return;
            if (pResult.success && pResult.data) {
              setProviderConfigs(pResult.data);
            }
          } catch (err) {
            console.error("Failed to fetch providers:", err);
          }
        }

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          period: statsPeriod,
          offset: "0",
        });
        if (searchQuery) params.append("email", searchQuery);
        if (providerFilter && providerFilter !== "")
          params.append("provider_id", providerFilter);
        if (emailFilter.length === 1) params.append("email", emailFilter[0]);

        const result = await callBackend(`/v1/accounts?${params.toString()}`, "GET", undefined, signal);
        if (result?.aborted || signal.aborted) return; // Request bị hủy bởi request mới hơn
        if (result.success && result.data) {
          const accountsList = result.data.accounts || [];

          // Fetch period stats for each account
          // NOTE: N+1 calls — đơn giản nhưng mỗi page load tốn ~21 requests.
          // <ceiling> — upgrade path: backend trả period_requests/period_tokens
          // trực tiếp trong /v1/accounts response, xóa toàn bộ khối Promise.all này.
          const accountsWithDailyStats = await Promise.all(
            accountsList.map(async (acc: any) => {
              try {
                const statsResult = await callBackend(
                  `/v1/stats?period=${statsPeriod}&account_id=${acc.id}`,
                  "GET",
                  undefined,
                  signal,
                );
                if (statsResult?.aborted || signal.aborted) throw new Error("aborted");
                let dailyTokens = 0;
                let dailyRequests = 0;

                if (statsResult.success && statsResult.data?.usage) {
                  // Sum all tokens and requests from hourly usage
                  dailyTokens = statsResult.data.usage.reduce(
                    (sum: number, hour: any) => sum + (hour.tokens || 0),
                    0,
                  );
                  dailyRequests = statsResult.data.usage.reduce(
                    (sum: number, hour: any) => sum + (hour.requests || 0),
                    0,
                  );
                }

                return {
                  id: acc.id,
                  provider_id: acc.provider_id,
                  email: acc.email,
                  credential: acc.credential,
                  total_requests: acc.total_requests || 0,
                  successful_requests: acc.successful_requests || 0,
                  total_tokens: acc.total_tokens || 0,
                  period_requests: dailyRequests,
                  period_tokens: dailyTokens,
                  user_data_dir: acc.user_data_dir,
                  is_active_cli: acc.is_active_cli,
                };
              } catch (err: any) {
                if (err.message === "aborted" || signal.aborted) {
                  throw err;
                }
                console.error(
                  `Failed to fetch stats for account ${acc.id}:`,
                  err,
                );
                return {
                  id: acc.id,
                  provider_id: acc.provider_id,
                  email: acc.email,
                  credential: acc.credential,
                  total_requests: acc.total_requests || 0,
                  successful_requests: acc.successful_requests || 0,
                  total_tokens: acc.total_tokens || 0,
                  period_requests: 0,
                  period_tokens: 0,
                  user_data_dir: acc.user_data_dir,
                  is_active_cli: acc.is_active_cli,
                };
              }
            }),
          );

          if (signal.aborted) return;
          setAccounts(accountsWithDailyStats);
          setAllAccounts(accountsWithDailyStats);
          setPagination({
            total: result.data.pagination?.total || 0,
            page: result.data.pagination?.page || page,
            limit: result.data.pagination?.limit || limit,
            total_pages: result.data.pagination?.total_pages || 1,
          });
        }
      } catch (err: any) {
        if (err?.message === "aborted" || signal.aborted) return;
        console.error("Failed to fetch accounts:", err);
      } finally {
        if (!silent && !signal.aborted) setLoading(false);
      }
    },
    [
      isOpen,
      searchQuery,
      providerFilter,
      emailFilter,
      providerConfigs.length,
      callBackend,
      statsPeriod,
    ],
  );

  // ── Effects ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Effects ──
  useEffect(() => {
    if (isOpen) {
      // Reset to page 1 and force fresh fetch when panel opens
      setPagination((prev) => ({ ...prev, page: 1 }));
      fetchAccounts(1, pagination.limit, false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts(1, pagination.limit);
    }
  }, [searchQuery, providerFilter, emailFilter, statsPeriod]);

  // ── Handlers ──
  const executeDelete = async () => {
    setDeleteLoading(true);
    try {
      if (deleteItem) {
        await callBackend(`/v1/accounts/${deleteItem.id}`, "DELETE");
      } else if (selectedAccounts.size > 0) {
        await Promise.all(
          Array.from(selectedAccounts).map((id) =>
            callBackend(`/v1/accounts/${id}`, "DELETE"),
          ),
        );
        setSelectedAccounts(new Set());
      }
      setConfirmOpen(false);
      setDeleteItem(null);
      fetchAccounts(pagination.page, pagination.limit, true);
    } catch (err) {
      console.error("Failed to delete accounts:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = (id: string, email?: string) => {
    setDeleteItem({ id, email });
    setConfirmOpen(true);
  };

  const handleBulkDelete = () => {
    setDeleteItem(null);
    setConfirmOpen(true);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedAccounts(newSelected);
  };

  const toggleAll = (newSelected: Set<string>) => {
    setSelectedAccounts(newSelected);
  };

  const switchKiroAccount = async (id: string) => {
    try {
      const result = await callBackend(`/v1/accounts/${id}/switch`, "POST");
      if (result.success) {
        fetchAccounts(pagination.page, pagination.limit, true);
      }
    } catch (err) {
      console.error("Failed to switch account:", err);
    }
  };

  return {
    accounts,
    allAccounts,
    loading,
    providerConfigs,
    searchQuery,
    setSearchQuery,
    pagination,
    selectedAccounts,
    confirmOpen,
    setConfirmOpen,
    deleteItem,
    deleteLoading,
    executeDelete,
    fetchAccounts,
    handleDelete,
    handleBulkDelete,
    toggleSelection,
    toggleAll,
    providerFilter,
    setProviderFilter,
    emailFilter,
    setEmailFilter,
    statsPeriod,
    setStatsPeriod,
    switchKiroAccount,
  };
};