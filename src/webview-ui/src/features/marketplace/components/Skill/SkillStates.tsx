import React from "react";
import { RefreshCw, PackageOpen, Search } from "lucide-react";

/** Trạng thái đang tải (dùng chung cho list và detail). */
export function LoadingState({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "8px",
        color: "var(--secondary-text)",
        fontSize: "13px",
      }}
    >
      <RefreshCw size={16} className="spin" />
      {label}
    </div>
  );
}

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

/**
 * Skeleton cho SkillCard — mô phỏng layout: title, author, 2 dòng desc,
 * stats và button góc phải.
 */
function SkillCardSkeleton() {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "10px",
        backgroundColor: "var(--input-bg)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
        }}
      >
        <SkeletonLine width={72} height={26} radius={4} />
      </div>
      <SkeletonLine width="55%" height={12} style={{ marginBottom: "6px" }} />
      <SkeletonLine width="35%" height={9} style={{ marginBottom: "10px" }} />
      <SkeletonLine
        width="100%"
        height={9}
        style={{ marginBottom: "5px" }}
      />
      <SkeletonLine width="80%" height={9} style={{ marginBottom: "12px" }} />
      <div style={{ display: "flex", gap: "12px" }}>
        <SkeletonLine width={38} height={8} />
        <SkeletonLine width={38} height={8} />
      </div>
    </div>
  );
}

/** Skeleton danh sách skill — lưới card (khớp padding/gap của SkillList). */
export function SkillListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "14px",
        padding: "0 16px 16px",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkillCardSkeleton key={i} />
      ))}
      <style>{`
        @keyframes skillShimmer {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .skill-skeleton-shimmer {
          animation: skillShimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Skeleton cho SkillDetail — breadcrumb, title, badges, description,
 * markdown content.
 */
export function SkillDetailSkeleton() {
  return (
    <div style={{ padding: "16px 20px" }}>
      <SkeletonLine width="40%" height={10} style={{ marginBottom: "16px" }} />
      <SkeletonLine width="60%" height={20} style={{ marginBottom: "10px" }} />
      <SkeletonLine width="30%" height={11} style={{ marginBottom: "16px" }} />
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <SkeletonLine width={70} height={18} radius={6} />
        <SkeletonLine width={70} height={18} radius={6} />
      </div>
      <SkeletonLine width="25%" height={11} style={{ marginBottom: "8px" }} />
      <SkeletonLine width="100%" height={9} style={{ marginBottom: "5px" }} />
      <SkeletonLine width="95%" height={9} style={{ marginBottom: "5px" }} />
      <SkeletonLine width="85%" height={9} style={{ marginBottom: "20px" }} />
      <SkeletonLine width="30%" height={11} style={{ marginBottom: "8px" }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={`${90 - i * 5}%`}
          height={9}
          style={{ marginBottom: "6px" }}
        />
      ))}
      <style>{`
        @keyframes skillShimmer {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .skill-skeleton-shimmer {
          animation: skillShimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
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