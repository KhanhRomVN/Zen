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
import { useState, useEffect, useCallback } from "react";

// ── Hooks ──
import { useSettings } from "../../../context/SettingsContext";

// ── Types ──
import { FlatAccount, Pagination } from "../types";

// ── Utils ──
import { extractAccessToken, isJwtExpired } from "../../../utils/jwt";

/** Trạng thái tài khoản dùng cho status badges ở AccountPanel. */
export type AccountStatus = "active" | "expired" | "error" | "inactive";

/**
 * Suy ra trạng thái của một tài khoản từ dữ liệu hiện có.
 * - active   : is_active_cli === true
 * - expired  : JWT token (accessToken) đã hết hạn
 * - inactive : is_active_cli === false (không phải active/expired)
 * - error    : chưa có nguồn dữ liệu → luôn 0 (chỗ giữ cho tương lai)
 */
export const getAccountStatus = (account: FlatAccount): AccountStatus => {
  if (account.is_active_cli === true) {
    // Vẫn ưu tiên báo expired nếu token đã hết hạn
    const token = extractAccessToken(account.credential || "");
    if (token && isJwtExpired(token)) return "expired";
    return "active";
  }
  const token = extractAccessToken(account.credential || "");
  if (token && isJwtExpired(token)) return "expired";
  if (account.is_active_cli === false) return "inactive";
  return "inactive";
};

// ─── Hook ───────────────────────────────────────────────────────────────
export const useAccounts = (isOpen: boolean) => {
  // ── State ──
  const [allAccounts, setAllAccounts] = useState<FlatAccount[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "">("");
  const [statsPeriod, setStatsPeriod] = useState<"day" | "week" | "month">(
    "day",
  );
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
    provider_name?: string;
    website_url?: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Store ──
  const { apiUrl, activeDatabaseManagerId } = useSettings();

  // ── Callbacks ──
  const callBackend = useCallback(
    async (endpoint: string, method: string = "GET", body?: any) => {
      const url = `${apiUrl}${endpoint}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeDatabaseManagerId) {
        headers["x-database-manager-id"] = activeDatabaseManagerId;
      }
      const options: RequestInit = {
        method,
        headers,
        cache: "no-store", // Prevent caching
      };
      if (body) options.body = JSON.stringify(body);
      const response = await fetch(url, options);
      return response.json();
    },
    [apiUrl, activeDatabaseManagerId],
  );

  const fetchAccounts = useCallback(
    async (page = 1, limit = 20, silent = false) => {
      if (!isOpen) return;
      if (!silent) setLoading(true);
      try {
        // Fetch providers first if empty
        if (providerConfigs.length === 0) {
          try {
            const pResult = await callBackend("/v1/providers");
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
        // searchQuery không gửi lên backend — search đa trường (email + provider_id
        // + provider_name) được thực hiện client-side sau khi fetch.
        if (providerFilter && providerFilter !== "")
          params.append("provider_id", providerFilter);
        if (emailFilter.length === 1) params.append("email", emailFilter[0]);

        const result = await callBackend(`/v1/accounts?${params.toString()}`);
        if (result.success && result.data) {
          const accountsList = result.data.accounts || [];

          // Fetch daily stats for each account
          const accountsWithDailyStats = await Promise.all(
            accountsList.map(async (acc: any) => {
              try {
                const statsResult = await callBackend(
                  `/v1/stats?period=${statsPeriod}&account_id=${acc.id}`,
                );
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
                  usage: acc.usage ?? null,
                  reset_usage_at: acc.reset_usage_at ?? null,
                };
              } catch (err) {
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
                  usage: acc.usage ?? null,
                  reset_usage_at: acc.reset_usage_at ?? null,
                };
              }
            }),
          );

          setAllAccounts(accountsWithDailyStats);
          setPagination({
            total: result.data.pagination?.total || 0,
            page: result.data.pagination?.page || page,
            limit: result.data.pagination?.limit || limit,
            total_pages: result.data.pagination?.total_pages || 1,
          });
        }
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [
      isOpen,
      providerFilter,
      emailFilter,
      providerConfigs.length,
      callBackend,
      statsPeriod,
    ],
  );

  // ── Effects ──
  useEffect(() => {
    if (isOpen) {
      // Reset to page 1 and force fresh fetch when panel opens
      setPagination((prev) => ({ ...prev, page: 1 }));
      fetchAccounts(1, pagination.limit, false);
    }
  }, [isOpen]);

  // searchQuery được filter client-side → không cần re-fetch khi gõ
  useEffect(() => {
    if (isOpen) {
      fetchAccounts(1, pagination.limit);
    }
  }, [providerFilter, emailFilter, statsPeriod]);

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

  const handleDelete = (id: string, email?: string, provider_name?: string, website_url?: string) => {
    setDeleteItem({ id, email, provider_name, website_url });
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

  const refreshAccountToken = async (id: string, providerId: string) => {
    try {
      const result = await callBackend(
        `/v1/accounts/${id}/refresh-token`,
        "POST",
        {
          provider_id: providerId,
        },
      );
      if (result.success) {
        fetchAccounts(pagination.page, pagination.limit, true);
      }
    } catch (err) {
      console.error("Failed to refresh token:", err);
    }
  };

  // ── Derived ──
  // Provider name lookup để phục vụ search mở rộng (email | provider_id | provider_name)
  const providerNameById = new Map<string, string>(
    providerConfigs.map((p) => [p.provider_id, p.provider_name || ""]),
  );

  // Đếm status trên TOÀN BỘ tài khoản đã fetch (không filter bởi statusFilter)
  const statusCounts: Record<AccountStatus, number> = {
    active: 0,
    expired: 0,
    error: 0,
    inactive: 0,
  };
  for (const acc of allAccounts) {
    statusCounts[getAccountStatus(acc)] += 1;
  }

  // Áp dụng filter client-side: search mở rộng + status. Provider filter vẫn
  // do backend xử lý (đã dùng làm query param trong fetchAccounts).
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const accounts = allAccounts.filter((acc) => {
    if (statusFilter && getAccountStatus(acc) !== statusFilter) return false;
    if (!normalizedQuery) return true;
    const providerName = providerNameById.get(acc.provider_id) || "";
    return (
      (acc.email || "").toLowerCase().includes(normalizedQuery) ||
      (acc.provider_id || "").toLowerCase().includes(normalizedQuery) ||
      providerName.toLowerCase().includes(normalizedQuery)
    );
  });

  return {
    accounts,
    allAccounts,
    statusCounts,
    statusFilter,
    setStatusFilter,
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
    refreshAccountToken,
  };
};
