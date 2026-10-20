import React from "react";
import { CheckCircle2, Clock, SkipForward } from "lucide-react";
import { SessionSummary } from "./types";
import {
  BAD_COLOR,
  IconBadge,
  OK_COLOR,
  cardStyle,
  ghostBtnStyle,
  labelStyle,
  primaryBtnStyle,
} from "./quizzes/shared";

interface Props {
  summary: SessionSummary;
  onReplay: () => void;
  onHome: () => void;
}

const fmtDuration = (sec: number): string =>
  sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;

const Tile: React.FC<{
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
  value: string;
}> = ({ icon, color, bg, label, value }) => (
  <div
    className="zg-card"
    style={{
      ...cardStyle,
      flex: "1 1 120px",
      flexDirection: "row",
      alignItems: "center",
      gap: "10px",
      padding: "10px",
    }}
  >
    <IconBadge icon={icon} color={color} bg={bg} />
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ fontSize: "15px", fontWeight: 700 }}>{value}</span>
    </div>
  </div>
);

const ChipGroup: React.FC<{ title: string; items: string[] }> = ({
  title,
  items,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <span style={labelStyle}>
      {title} ({items.length})
    </span>
    {items.length === 0 ? (
      <div style={{ fontSize: "12px", color: "var(--secondary-text)" }}>—</div>
    ) : (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {items.map((t) => (
          <span
            key={t}
            style={{
              padding: "3px 10px",
              borderRadius: "999px",
              border: "1px solid var(--border-color)",
              background: "rgba(128, 128, 128, 0.08)",
              fontSize: "12px",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    )}
  </div>
);

const ResultScreen: React.FC<Props> = ({ summary, onReplay, onHome }) => {
  const accuracy =
    summary.total === 0 ? 0 : Math.round((summary.correct / summary.total) * 100);
  const tone = accuracy >= 60 ? OK_COLOR : BAD_COLOR;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          ...cardStyle,
          alignItems: "center",
          gap: "8px",
          padding: "24px 14px",
        }}
      >
        <span style={labelStyle}>Session result</span>
        <div
          style={{
            fontSize: "44px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: tone,
          }}
        >
          {accuracy}%
        </div>
        <div
          style={{
            width: "60%",
            height: "6px",
            borderRadius: "3px",
            background: "rgba(128,128,128,0.2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${accuracy}%`,
              height: "100%",
              background: tone,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <Tile
          icon={<CheckCircle2 size={16} />}
          color="var(--vscode-gitDecoration-addedResourceForeground, #10b981)"
          bg="rgba(16, 185, 129, 0.1)"
          label="Correct"
          value={`${summary.correct}/${summary.total}`}
        />
        <Tile
          icon={<SkipForward size={16} />}
          color="var(--vscode-editorWarning-foreground, #f59e0b)"
          bg="rgba(245, 158, 11, 0.1)"
          label="Skipped"
          value={String(summary.skipped)}
        />
        <Tile
          icon={<Clock size={16} />}
          color="var(--vscode-textLink-foreground, #3b82f6)"
          bg="rgba(59, 130, 246, 0.1)"
          label="Time"
          value={fmtDuration(summary.durationSec)}
        />
      </div>

      <div style={{ ...cardStyle, gap: "14px" }}>
        <span style={labelStyle}>Still weak in this session</span>
        <ChipGroup
          title="Words"
          items={summary.weak.filter((w) => w.kind === "word").map((w) => w.text)}
        />
        <ChipGroup
          title="Phrases"
          items={summary.weak
            .filter((w) => w.kind === "phrase")
            .map((w) => w.text)}
        />
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          className="zg-btn"
          onClick={onHome}
          style={{ ...ghostBtnStyle, padding: "8px 18px", fontSize: "13px" }}
        >
          Back to home
        </button>
        <button
          className="zg-btn"
          onClick={onReplay}
          style={primaryBtnStyle(false)}
        >
          Play again
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;