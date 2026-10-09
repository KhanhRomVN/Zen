/**
 * ------------------------------------------------------------------
 * AccountPanel
 * ------------------------------------------------------------------
 * Panel quản lý tài khoản — hiển thị danh sách tài khoản, tìm kiếm,
 * lọc theo provider, thêm/xóa/chuyển đổi tài khoản CLI.

 * Main features:
 * - Hiển thị danh sách tài khoản kèm thống kê daily requests/tokens
 * - Tìm kiếm theo email và lọc theo provider
 * - Thêm tài khoản mới (drawer), import JSON, xóa đơn lẻ hoặc hàng loạt
 * - Chuyển đổi tài khoản đang hoạt động trên CLI
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useState } from "react";

// ── UI ──
import {
  Loader2,
  Plus,
  Search,
  Upload,
  Download,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Copy,
  RefreshCw,
  CheckSquare,
  Square,
} from "lucide-react";

// ── Components ──
import AccountCard from "./components/AccountCard";
import AddAccountDrawer from "./components/AddAccountDrawer";
import EditAccountDrawer from "./components/EditAccountDrawer";
import ConfirmDeleteAccountDrawer from "./components/ConfirmDeleteAccountDrawer";
import ImportDuplicatesDrawer, { DuplicateEntry } from "./components/ImportDuplicatesDrawer";
import { AccountListSkeleton } from "./components/AccountListSkeleton";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../components/ui/Dropdown";

// ── Hooks ──
import { useAccounts } from "./hooks/useAccounts";
import { useSettings } from "../../context/SettingsContext";
import { useActiveDatabaseManagerName } from "../../hooks/useActiveDatabaseManagerName";

// ── Services ──
import { extensionService, messageDispatcher } from "../../services/ExtensionService";

// ── Types ──
import { FlatAccount } from "./types";

// ── Utils ──
import { getFaviconUrl } from "../../utils/favicon";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── SelectionOverlayBar ────────────────────────────────────────────────
interface OverlayBarProps {
  selectedCount: number;
  allVisibleSelected: boolean;
  onSelectAll: () => void;
  onCopySelected: () => void;
  onRefreshSelected: () => void;
  onExportSelected: () => void;
  onDeleteSelected: () => void;
}

const OverlayBarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  title?: string;
}> = ({ icon, label, onClick, variant = "default", title }) => {
  const [hovered, setHovered] = useState(false);
  const isDanger = variant === "danger";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title ?? label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: hovered ? "6px" : "0",
        padding: hovered ? "6px 10px" : "6px 8px",
        borderRadius: "8px",
        border: "none",
        backgroundColor: isDanger
          ? hovered ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.08)"
          : hovered ? "rgba(255,255,255,0.1)" : "transparent",
        color: isDanger
          ? "var(--vscode-errorForeground, #f87171)"
          : "var(--primary-text)",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: 500,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
        maxWidth: hovered ? "140px" : "32px",
        flexShrink: 0,
      }}
    >
      <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{
        overflow: "hidden",
        maxWidth: hovered ? "100px" : "0",
        opacity: hovered ? 1 : 0,
        transition: "max-width 0.15s ease, opacity 0.1s ease",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </button>
  );
};

const SelectionOverlayBar: React.FC<OverlayBarProps> = ({
  selectedCount, allVisibleSelected,
  onSelectAll, onCopySelected, onRefreshSelected, onExportSelected, onDeleteSelected,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(90%, calc(100% - 32px))",
        backgroundColor: "var(--vscode-editorWidget-background, #1e1e2e)",
        border: "1.5px dashed color-mix(in srgb, var(--vscode-focusBorder, #3b82f6) 50%, transparent)",
        borderRadius: "14px",
        padding: "6px 10px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        zIndex: 200,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        animation: "overlaySlideUp 0.2s ease",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Count badge */}
      <div style={{
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--vscode-focusBorder, #3b82f6)",
        backgroundColor: "color-mix(in srgb, var(--vscode-focusBorder, #3b82f6) 12%, transparent)",
        padding: "3px 8px",
        borderRadius: "6px",
        whiteSpace: "nowrap",
        flexShrink: 0,
        marginRight: "4px",
      }}>
        {selectedCount} selected
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border-color)", flexShrink: 0 }} />

      {/* Select All / Deselect All */}
      <OverlayBarButton
        icon={allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
        label={allVisibleSelected ? "Deselect All" : "Select All"}
        onClick={onSelectAll}
        title={allVisibleSelected ? "Deselect all visible" : "Select all visible"}
      />

      {/* Copy */}
      <OverlayBarButton
        icon={<Copy size={14} />}
        label="Copy JSON"
        onClick={onCopySelected}
        title="Copy selected as JSON"
      />

      {/* Refresh Token */}
      <OverlayBarButton
        icon={<RefreshCw size={14} />}
        label="Refresh Tokens"
        onClick={onRefreshSelected}
        title="Refresh tokens for selected"
      />

      {/* Export */}
      <OverlayBarButton
        icon={<Download size={14} />}
        label="Export"
        onClick={onExportSelected}
        title="Export selected to JSON file"
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Divider */}
      <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border-color)", flexShrink: 0 }} />

      {/* Delete */}
      <OverlayBarButton
        icon={<Trash2 size={14} />}
        label="Delete"
        onClick={onDeleteSelected}
        variant="danger"
        title="Delete selected accounts"
      />
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────
const AccountPanel: React.FC<AccountPanelProps> = ({ isOpen, onClose }) => {
  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<FlatAccount | null>(null);
  const [closeHover, setCloseHover] = useState(false);
  const [importDuplicates, setImportDuplicates] = useState<DuplicateEntry[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importLoadingMsg, setImportLoadingMsg] = useState("");
  const [importDuplicatesOpen, setImportDuplicatesOpen] = useState(false);
  const { apiUrl, activeDatabaseManagerId } = useSettings();
  const activeDbName = useActiveDatabaseManagerName();

  // ── Store ──
  const {
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
    refreshAccountToken,
    statusCounts,
    statusFilter,
    setStatusFilter,
  } = useAccounts(isOpen);

  // ── Derived ──
  const allVisibleSelected =
    accounts.length > 0 &&
    accounts.every((acc) => selectedAccounts.has(acc.id));

  const sortedProviderConfigs = [...providerConfigs].sort((a, b) => {
    if (a.is_enabled === b.is_enabled) return 0;
    return a.is_enabled ? -1 : 1;
  });

  // ── Handlers ──
  const handleImport = () => {
    const requestId = `import-${Date.now()}`;

    // Lắng nghe preview response từ extension
    messageDispatcher.register(
      requestId,
      (msg) => {
        // Intermediate status: file đã chọn, đang gọi API
        if (msg.status === "analyzing") {
          setImportLoading(true);
          setImportLoadingMsg(`Analyzing ${msg.count} account${msg.count !== 1 ? "s" : ""}\u2026`);
          return true; // Giữ handler — còn chờ preview result
        }

        setImportLoading(false);
        setImportLoadingMsg("");

        if (msg.error) {
          console.error("[Import] Error:", msg.error);
          return;
        }

        // SQLite path: backend import thẳng, không qua preview
        if (msg.isSqlite) {
          fetchAccounts(pagination.page, pagination.limit, true);
          return;
        }

        // JSON path: nhận preview data → mở drawer để user confirm
        const previewAccounts = msg.preview?.data?.accounts;
        if (!Array.isArray(previewAccounts) || previewAccounts.length === 0) {
          console.warn("[Import] Preview returned empty accounts");
          return;
        }

        setImportDuplicates(previewAccounts);
        setImportDuplicatesOpen(true);
      },
      60_000,
      () => {
        setImportLoading(false);
        setImportLoadingMsg("");
        console.warn("[Import] Timeout after 60s");
      },
    );

    extensionService.postMessage({
      command: "importAccounts",
      apiUrl,
      requestId,
      databaseManagerId: activeDatabaseManagerId ?? null,
    });
  };

  /**
   * Gọi sau khi user confirm trong drawer.
   * selectedEntries là các preview entries được chọn.
   * - New      → insert qua /import
   * - Changed  → override qua /accounts/override
   * - Identical→ bỏ qua
   */
  const handleConfirmImport = async (selectedEntries: DuplicateEntry[]) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (activeDatabaseManagerId) headers["x-database-manager-id"] = activeDatabaseManagerId;

    const toInsert = selectedEntries
      .filter((e: any) => e.kind === "new")
      .map((e: any) => e.incoming);

    const toOverride = selectedEntries.filter((e: any) => e.kind === "changed");

    await Promise.all([
      // Insert new accounts
      toInsert.length > 0
        ? fetch(`${apiUrl}/v1/accounts/import`, {
            method: "POST",
            headers,
            body: JSON.stringify(toInsert),
          })
        : Promise.resolve(),

      // Override changed accounts
      ...toOverride.map((entry: any) =>
        fetch(`${apiUrl}/v1/accounts/override`, {
          method: "POST",
          headers,
          body: JSON.stringify({ existingId: entry.existing.id, incoming: entry.incoming }),
        }),
      ),
    ]);

    fetchAccounts(pagination.page, pagination.limit, true);
  };


  const handleExport = () => {
    const fileName = `zen-${accounts.length}-${Date.now()}.json`;
    extensionService.postMessage({
      command: "exportAccounts",
      fileName,
      content: JSON.stringify(accounts, null, 2),
    });
  };

  const handlePrevPage = () => {
    if (pagination.page > 1) {
      fetchAccounts(pagination.page - 1, pagination.limit);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.total_pages) {
      fetchAccounts(pagination.page + 1, pagination.limit);
    }
  };

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      const newSelected = new Set(selectedAccounts);
      accounts.forEach((acc) => newSelected.delete(acc.id));
      toggleAll(newSelected);
    } else {
      const newSelected = new Set(selectedAccounts);
      accounts.forEach((acc) => newSelected.add(acc.id));
      toggleAll(newSelected);
    }
  };

  if (!isOpen) return null;

  // ── Render ──
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header - Following SettingsPanel style */}
      <div
        style={{
          padding: "16px 16px 7px",
          borderTop: "1px solid var(--border-color)",
          flexShrink: 0,
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div>
              <div style={{ marginBottom: "3px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "var(--primary-text)",
                    letterSpacing: "0.01em",
                  }}
                >
                  Accounts
                </span>
                {activeDbName && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      padding: "2px 7px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(59, 130, 246, 0.12)",
                      color: "#3b82f6",
                      letterSpacing: "0.01em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {activeDbName}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                  lineHeight: 1.4,
                }}
              >
                Manage AI vendor accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{
              padding: "5px",
              borderRadius: "6px",
              flexShrink: 0,
              backgroundColor: closeHover
                ? "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.12))"
                : "rgba(128,128,128,0.1)",
              border: "none",
              color: closeHover
                ? "var(--vscode-errorForeground)"
                : "var(--secondary-text)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Close Accounts"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Action Bar - Below divider */}
      <div
        style={{
          padding: "8px 16px 12px",
          backgroundColor: "var(--tertiary-bg)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Search Input */}
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              placeholder="Search by email, provider ID or provider name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="account-search-input"
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                fontSize: "13px",
                backgroundColor: "var(--input-bg)",
                border: "none",
                borderRadius: "8px",
                color: "var(--primary-text)",
                outline: "none",
                boxSizing: "border-box",
                height: "34px",
              }}
            />
            <Search
              style={{
                width: "14px",
                height: "14px",
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--secondary-text)",
              }}
            />
          </div>

          <Dropdown align="end" sideOffset={4}>
            <DropdownTrigger asChild>
              <button
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  backgroundColor: providerFilter
                    ? "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)"
                    : "var(--input-bg)",
                  border: providerFilter
                    ? "1px solid color-mix(in srgb, var(--vscode-button-background) 40%, transparent)"
                    : "none",
                  color: providerFilter
                    ? "var(--vscode-button-background)"
                    : "var(--secondary-text)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  padding: 0,
                }}
                title={
                  providerFilter
                    ? `Filtering: ${sortedProviderConfigs.find((p) => p.provider_id === providerFilter)?.provider_name ?? providerFilter}`
                    : "Filter by provider"
                }
              >
                {(() => {
                  if (!providerFilter) return <Filter size={16} />;
                  const pc = sortedProviderConfigs.find((p) => p.provider_id === providerFilter);
                  if (!pc?.website) return <Filter size={16} />;
                  return (
                    <img
                      src={getFaviconUrl(pc.website)}
                      alt={pc.provider_name}
                      style={{ width: "18px", height: "18px", objectFit: "contain", borderRadius: "3px" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`;
                        }
                      }}
                    />
                  );
                })()}
              </button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem
                icon={
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "3px",
                      backgroundColor: "rgba(128,128,128,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      fontWeight: "bold",
                      color: "var(--secondary-text)",
                    }}
                  >
                    All
                  </div>
                }
                onClick={() => setProviderFilter("")}
              >
                All Providers [{accounts.length}]
              </DropdownItem>
              {sortedProviderConfigs.map((provider) => (
                <DropdownItem
                  key={provider.provider_id}
                  disabled={provider.is_enabled === false}
                  icon={
                    <img
                      src={getFaviconUrl(provider.website)}
                      alt={provider.provider_name}
                      style={{
                        width: "16px",
                        height: "16px",
                        objectFit: "contain",
                      }}
                      onError={(e) => {
                        console.error(
                          `[Favicon] Load FAILED: ${provider.provider_id} -> ${getFaviconUrl(provider.website)}`,
                        );
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  }
                  onClick={() => setProviderFilter(provider.provider_id)}
                >
                  {provider.provider_name} [
                  {
                    accounts.filter(
                      (acc) => acc.provider_id === provider.provider_id,
                    ).length
                  }
                  ]
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>

          <button
            onClick={() => setDialogOpen(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--input-bg)";
            }}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "var(--input-bg)",
              border: "none",
              color: "var(--secondary-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Add account"
          >
            <Plus size={16} />
          </button>

          <Dropdown align="end" sideOffset={4}>
            <DropdownTrigger asChild>
              <button
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  backgroundColor: "var(--input-bg)",
                  border: "none",
                  color: "var(--secondary-text)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                title="More options"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem icon={<Upload size={14} />} onClick={handleImport}>
                Import Account
              </DropdownItem>
              <DropdownItem
                icon={<Download size={14} />}
                onClick={handleExport}
              >
                Export JSON
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>

        {/* Status badges — click để filter (chỉ Active/Expired có dữ liệu) */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            marginTop: "8px",
            flexWrap: "wrap",
          }}
        >
          {(
            [
              { key: "active", label: "Active", count: statusCounts.active },
              { key: "expired", label: "Expired", count: statusCounts.expired },
              { key: "error", label: "Error", count: 0, disabled: true },
              { key: "inactive", label: "Inactive", count: statusCounts.inactive },
            ] as const
          ).map((b) => {
            const isOn = statusFilter === b.key;
            const disabled = "disabled" in b && b.disabled;
            return (
              <button
                key={b.key}
                type="button"
                disabled={disabled}
                onClick={() =>
                  !disabled && setStatusFilter(isOn ? "" : (b.key as any))
                }
                title={disabled ? "No data source yet" : `Filter: ${b.label}`}
                style={{
                  fontSize: "11px",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: isOn
                    ? "color-mix(in srgb, var(--vscode-button-background) 25%, transparent)"
                    : "var(--input-bg)",
                  color: isOn
                    ? "var(--vscode-button-background)"
                    : "var(--secondary-text)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {b.label}[{b.count}]
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Actions Bar — replaced by OverlayBar below */}

      {/* Header: label + period tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          marginTop: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            List Account
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: "6px",
              backgroundColor: "rgba(128,128,128,0.1)",
              color: "var(--secondary-text)",
            }}
          >
            {accounts.length}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "4px",
            backgroundColor: "var(--input-bg)",
            padding: "3px",
            borderRadius: "8px",
          }}
        >
          {(["day", "week", "month", "year", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setStatsPeriod(p)}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor:
                  statsPeriod === p
                    ? "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)"
                    : "transparent",
                color:
                  statsPeriod === p
                    ? "var(--vscode-button-background)"
                    : "var(--secondary-text)",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {p === "day" ? "Day" : p === "week" ? "Week" : p === "month" ? "Month" : p === "year" ? "Year" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Account List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {loading && accounts.length === 0 ? (
          <AccountListSkeleton count={5} />
        ) : accounts.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              color: "var(--secondary-text)",
              gap: "12px",
              textAlign: "center",
            }}
          >
            <Users size={40} style={{ opacity: 0.3 }} />
            <div>
              <p
                style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}
              >
                {searchQuery || statusFilter
                  ? "No matching accounts"
                  : "No accounts yet"}
              </p>
              <p style={{ fontSize: "11px", margin: 0, opacity: 0.7 }}>
                {searchQuery || statusFilter
                  ? "Try a different search or filter"
                  : "Click the + button to add one"}
              </p>
            </div>
          </div>
        ) : (
          accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isSelected={selectedAccounts.has(account.id)}
              anySelected={selectedAccounts.size > 0}
              onToggleSelect={() => toggleSelection(account.id)}
              onDelete={() => {
                const pc = providerConfigs.find((p) => p.provider_id === account.provider_id);
                handleDelete(account.id, account.email, pc?.provider_name, pc?.website);
              }}
              onSwitch={() => switchKiroAccount(account.id)}
              onRefreshToken={() => refreshAccountToken(account.id, account.provider_id)}
              onEdit={() => setEditAccount(account)}
              providerConfig={providerConfigs.find(
                (p) => p.provider_id === account.provider_id,
              )}
              statsPeriod={statsPeriod}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            backgroundColor: "var(--tertiary-bg)",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--secondary-text)" }}>
            {pagination.page} / {pagination.total_pages}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handlePrevPage}
              disabled={pagination.page === 1}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                color: "var(--primary-text)",
                cursor: pagination.page === 1 ? "not-allowed" : "pointer",
                opacity: pagination.page === 1 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
              }}
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={pagination.page === pagination.total_pages}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                color: "var(--primary-text)",
                cursor:
                  pagination.page === pagination.total_pages
                    ? "not-allowed"
                    : "pointer",
                opacity: pagination.page === pagination.total_pages ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <AddAccountDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchAccounts(pagination.page, pagination.limit, true)}
      />

      <EditAccountDrawer
        open={!!editAccount}
        account={editAccount}
        onOpenChange={(o) => { if (!o) setEditAccount(null); }}
        onSuccess={() => fetchAccounts(pagination.page, pagination.limit, true)}
        providerConfig={
          editAccount
            ? providerConfigs.find((p) => p.provider_id === editAccount.provider_id) ?? null
            : null
        }
      />

      <ConfirmDeleteAccountDrawer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={executeDelete}
        loading={deleteLoading}
        email={deleteItem?.email}
        providerName={deleteItem?.provider_name}
        websiteUrl={deleteItem?.website_url}
        count={deleteItem ? 1 : selectedAccounts.size}
      />

      <ImportDuplicatesDrawer
        open={importDuplicatesOpen}
        onOpenChange={setImportDuplicatesOpen}
        duplicates={importDuplicates}
        providerConfigs={providerConfigs}
        onOverride={handleConfirmImport}
        onDone={() => fetchAccounts(pagination.page, pagination.limit, true)}
      />

      {/* ── Import Loading Toast ── */}
      {importLoading && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            backgroundColor: "var(--tertiary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            whiteSpace: "nowrap",
            animation: "importToastIn 0.2s ease",
          }}
        >
          <Loader2
            size={14}
            style={{
              animation: "importSpin 1s linear infinite",
              color: "var(--vscode-button-background, #3b82f6)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--primary-text)" }}>
            {importLoadingMsg}
          </span>
        </div>
      )}

      <style>{`
        @keyframes importToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes importSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Selection Overlay Bar ─────────────────────────────────────── */}
      {selectedAccounts.size > 0 && (
        <SelectionOverlayBar
          selectedCount={selectedAccounts.size}
          allVisibleSelected={allVisibleSelected}
          onSelectAll={handleSelectAll}
          onCopySelected={() => {
            const selected = accounts.filter((a) => selectedAccounts.has(a.id));
            navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
          }}
          onRefreshSelected={() => {
            accounts
              .filter((a) => selectedAccounts.has(a.id))
              .forEach((a) => refreshAccountToken(a.id, a.provider_id));
          }}
          onExportSelected={() => {
            const selected = accounts.filter((a) => selectedAccounts.has(a.id));
            const fileName = `zen-selected-${selected.length}-${Date.now()}.json`;
            extensionService.postMessage({
              command: "exportAccounts",
              fileName,
              content: JSON.stringify(selected, null, 2),
            });
          }}
          onDeleteSelected={handleBulkDelete}
        />
      )}

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .account-search-input::placeholder {
            color: var(--secondary-text);
            opacity: 0.7;
          }

          @keyframes overlaySlideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(12px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default AccountPanel;
