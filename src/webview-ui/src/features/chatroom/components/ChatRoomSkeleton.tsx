/**
 * ------------------------------------------------------------------
 * ChatRoomSkeleton
 * ------------------------------------------------------------------
 * Skeleton loading cho vùng tin nhắn chatroom: mô phỏng avatar, tên và
 * bubble của tin nhắn người khác / của mình.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";

// ─── Constants ──────────────────────────────────────────────────────────
const ROWS: Array<{ own: boolean; width: number; lines: number }> = [
  { own: false, width: 60, lines: 2 },
  { own: true, width: 38, lines: 1 },
  { own: false, width: 72, lines: 3 },
  { own: true, width: 46, lines: 2 },
  { own: false, width: 34, lines: 1 },
];

const LINE_WIDTHS = ["100%", "100%", "60%"];

// ─── Sub components ─────────────────────────────────────────────────────
const Block: React.FC<{
  width: string | number;
  height: number;
  radius?: number;
}> = ({ width, height, radius = 4 }) => (
  <div
    className="cr-skeleton-shimmer"
    style={{
      width,
      height,
      borderRadius: radius,
      flexShrink: 0,
      backgroundColor: "rgba(128,128,128,0.15)",
    }}
  />
);

// ─── Component ──────────────────────────────────────────────────────────
const ChatRoomSkeleton: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    {ROWS.map((row, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          flexDirection: row.own ? "row-reverse" : "row",
          alignItems: "flex-start",
          gap: 10,
          marginTop: i === 0 ? 8 : 14,
        }}
      >
        <Block width={36} height={36} radius={6} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: row.own ? "flex-end" : "flex-start",
            gap: 6,
            width: "72%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: row.own ? "row-reverse" : "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Block width={64} height={10} />
            <Block width={28} height={9} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              width: `${row.width}%`,
              padding: "10px 12px",
              boxSizing: "border-box",
              borderRadius: 12,
              backgroundColor: "rgba(128,128,128,0.1)",
            }}
          >
            {Array.from({ length: row.lines }).map((_, j) => (
              <Block
                key={j}
                width={row.lines === 1 ? "100%" : LINE_WIDTHS[j]}
                height={9}
              />
            ))}
          </div>
        </div>
      </div>
    ))}
    <style>{`
      @keyframes crSkeletonPulse {
        0% { opacity: 0.55; }
        50% { opacity: 1; }
        100% { opacity: 0.55; }
      }
      .cr-skeleton-shimmer { animation: crSkeletonPulse 1.4s ease-in-out infinite; }
    `}</style>
  </div>
);

export default ChatRoomSkeleton;