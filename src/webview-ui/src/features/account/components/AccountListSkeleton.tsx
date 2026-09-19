import React from "react";

function SkeletonLine({
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
      className="account-skeleton-shimmer"
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

/** Một card skeleton mô phỏng layout AccountCard: icon, title/email, stats. */
function AccountCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "var(--input-bg)",
        borderRadius: "12px",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <SkeletonLine width={32} height={32} radius={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <SkeletonLine
          width="65%"
          height={11}
          style={{ marginBottom: "6px" }}
        />
        <div style={{ display: "flex", gap: "10px" }}>
          <SkeletonLine width={54} height={9} />
          <SkeletonLine width={54} height={9} />
          <SkeletonLine width={40} height={9} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton danh sách account — hiển thị trong lúc useAccounts đang fetch
 * lần đầu (loading && accounts.length === 0).
 */
export function AccountListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <AccountCardSkeleton key={i} />
      ))}
      <style>{`
        @keyframes accountShimmer {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .account-skeleton-shimmer {
          animation: accountShimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}