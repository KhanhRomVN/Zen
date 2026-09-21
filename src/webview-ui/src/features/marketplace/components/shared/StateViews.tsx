/**
 * ------------------------------------------------------------------
 * StateViews — các UI trạng thái dùng chung trong Marketplace:
 * skeleton primitive + error / empty / no-results state.
 * ------------------------------------------------------------------
 */

import React from "react";
import { RefreshCw, PackageOpen, Search } from "lucide-react";

/** Khối skeleton cơ bản — 1 dải xám với hiệu ứng shimmer. */
export function SkeletonLine({
  width,
  height = 10,
  radius = 4,
  style,
}: {
  width: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skill-skeleton-shimmer"
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: "rgba(128,128,128,0.15)",
        ...style,
      }}
    />
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

/** Trạng thái lỗi kèm nút retry. */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "12px",
        textAlign: "center",
        padding: "32px 16px",
      }}
    >
      <p
        style={{
          color: "var(--vscode-errorForeground, #f48771)",
          fontSize: "13px",
          maxWidth: "320px",
        }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "6px",
          border: "none",
          backgroundColor: "var(--vscode-button-background, #0e639c)",
          color: "#fff",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        <RefreshCw size={14} />
        {retryLabel}
      </button>
    </div>
  );
}

/** Trạng thái rỗng — không có skill nào. */
export function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "8px",
        color: "var(--secondary-text)",
        fontSize: "13px",
        textAlign: "center",
      }}
    >
      <PackageOpen size={32} style={{ opacity: 0.3 }} />
      No skills found
    </div>
  );
}

/** Trạng thái rỗng cho manager view — chưa cài skill nào. */
export function EmptyInstalledState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "8px",
        color: "var(--secondary-text)",
        fontSize: "13px",
        textAlign: "center",
        padding: "32px 16px",
      }}
    >
      <PackageOpen size={32} style={{ opacity: 0.3 }} />
      <span>No skills installed yet</span>
      <span style={{ fontSize: "11px", opacity: 0.6 }}>
        Install a skill from Browse to see it here.
      </span>
    </div>
  );
}

/** Trạng thái không có kết quả khớp với query tìm kiếm. */
export function NoResultsState({ query }: { query: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "8px",
        color: "var(--secondary-text)",
        fontSize: "13px",
        textAlign: "center",
      }}
    >
      <Search size={32} style={{ opacity: 0.3 }} />
      <span>No results for "{query}"</span>
    </div>
  );
}