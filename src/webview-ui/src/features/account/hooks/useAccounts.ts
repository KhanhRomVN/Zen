import { useState, useEffect, useCallback } from "react";
import { FlatAccount, Pagination } from "../types";
import { useSettings } from "../../../context/SettingsContext";

export const useAccounts = (isOpen: boolean) => {
  const { apiUrl } = useSettings();
  const [accounts, setAccounts] = useState<FlatAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<FlatAccount[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("");
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

  const callBackend = useCallback(
    async (endpoint: string, method: string = "GET", body?: any) => {
      const url = `${apiUrl}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
        cache: "no-store", // Prevent caching
      };
      if (body) options.body = JSON.stringify(body);
      const response = await fetch(url, options);
      return response.json();
    },
    [apiUrl],
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
          period: "day",
          offset: "0",
        });
        if (searchQuery) params.append("email", searchQuery);
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
                  `/v1/stats?period=day&account_id=${acc.id}`,
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
                  daily_requests: dailyRequests,
                  daily_tokens: dailyTokens,
                  is_active_cli: acc.is_active_cli,
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
                  daily_requests: 0,
                  daily_tokens: 0,
                  is_active_cli: acc.is_active_cli,
                };
              }
            }),
          );

          setAccounts(accountsWithDailyStats);
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
      searchQuery,
      providerFilter,
      emailFilter,
      providerConfigs.length,
      callBackend,
    ],
  );

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
  }, [searchQuery, providerFilter, emailFilter]);

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
    switchKiroAccount,
  };
};
