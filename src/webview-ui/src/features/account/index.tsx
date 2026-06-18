import React, { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Search,
  Upload,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Users,
} from "lucide-react";
import AccountCard from "./components/AccountCard";
import AddAccountDrawer from "./components/AddAccountDrawer";
import ConfirmDeleteDrawer from "./components/ConfirmDeleteDrawer";
import ProviderFilterDropdown from "./components/ProviderFilterDropdown";
import { useAccounts } from "./hooks/useAccounts";
import { getFaviconUrl } from "./utils";

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountPanel: React.FC<AccountPanelProps> = ({ isOpen, onClose }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    switchKiroAccount,
  } = useAccounts(isOpen);

  const [closeHover, setCloseHover] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = () => setShowDropdown(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  const handleImport = async () => {
    try {
      const result = await (window as any).api?.accounts?.import?.();
      if (result?.success) {
        fetchAccounts(pagination.page, pagination.limit, true);
      }
    } catch (error) {
      console.error("Failed to import:", error);
    }
    setShowDropdown(false);
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

  const allVisibleSelected =
    accounts.length > 0 && accounts.every((acc) => selectedAccounts.has(acc.id));

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

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header - Following SettingsPanel style */}
      <div
        style={{
          padding: "16px 16px 14px",
          borderTop: "1px solid var(--border-color)",
          borderBottom: "1px solid var(--border-color)",
          flexShrink: 0,
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                flexShrink: 0,
                background: "rgba(128,128,128,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--vscode-foreground)",
              }}
            >
              <Smartphone size={18} />
            </div>
            <div>
              <div style={{ marginBottom: "3px" }}>
                <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--primary-text)", letterSpacing: "0.01em" }}>
                  Accounts
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--secondary-text)", opacity: 0.7, lineHeight: 1.4 }}>
                Manage your API accounts
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
              color: closeHover ? "var(--vscode-errorForeground)" : "var(--secondary-text)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Close Accounts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Action Bar - Below divider */}
      <div
        style={{
          padding: "16px 16px 12px",
          backgroundColor: "var(--tertiary-bg)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Search Input */}
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                fontSize: "13px",
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-color)",
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
          
          <ProviderFilterDropdown
            providerConfigs={providerConfigs}
            selectedProvider={providerFilter}
            onSelectProvider={setProviderFilter}
            getFaviconUrl={getFaviconUrl}
          />
          
          <button
            onClick={() => setDialogOpen(true)}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "var(--vscode-button-background)",
              border: "none",
              color: "var(--vscode-button-foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: 0.45,
              transition: "opacity 0.15s ease",
            }}
            title="Add account"
          >
            <Plus size={16} />
          </button>
          
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                color: "var(--secondary-text)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              title="More options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
            {showDropdown && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "8px",
                  width: "160px",
                  backgroundColor: "var(--tertiary-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={handleImport}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--primary-text)",
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Upload size={14} />
                  <span>Import JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedAccounts.size > 0 && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px 12px",
            backgroundColor: "var(--vscode-list-activeSelectionBackground, rgba(128,128,128,0.1))",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginLeft: "16px",
            marginRight: "16px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--primary-text)" }}>
            {selectedAccounts.size} selected
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSelectAll}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "transparent",
                border: "1px solid var(--border-color)",
                color: "var(--secondary-text)",
                fontSize: "11px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {allVisibleSelected ? "Deselect All" : "Select All"}
            </button>
            <button
              onClick={handleBulkDelete}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.12))",
                border: "none",
                color: "var(--vscode-errorForeground, #f87171)",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      )}

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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              color: "var(--secondary-text)",
              gap: "12px",
            }}
          >
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--accent-text)" }} />
            <span style={{ fontSize: "12px" }}>Loading accounts...</span>
          </div>
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
              <p style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}>
                {searchQuery ? "No matching accounts" : "No accounts yet"}
              </p>
              <p style={{ fontSize: "11px", margin: 0, opacity: 0.7 }}>
                {searchQuery ? "Try a different search" : "Click the + button to add one"}
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
              onDelete={() => handleDelete(account.id, account.email)}
              onSwitch={() => switchKiroAccount(account.id)}
              providerConfig={providerConfigs.find((p) => p.provider_id === account.provider_id)}
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
                cursor: pagination.page === pagination.total_pages ? "not-allowed" : "pointer",
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

      <ConfirmDeleteDrawer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={executeDelete}
        loading={deleteLoading}
        title={deleteItem ? `Delete account ${deleteItem.email ?? ''}?` : "Delete selected accounts"}
        count={deleteItem ? 1 : selectedAccounts.size}
      />

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AccountPanel;