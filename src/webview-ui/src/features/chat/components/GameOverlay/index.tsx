import React from "react";
import { GraduationCap } from "lucide-react";
import AiStatus from "./english/AiStatus";
import EnglishGame from "./english/EnglishGame";
import { GameStyles, IconBadge, labelStyle } from "./english/quizzes/shared";

interface GameOverlayProps {
  isProcessing?: boolean;
}

const GameOverlay: React.FC<GameOverlayProps> = ({ isProcessing = false }) => (
  <div
    style={{
      width: "90%",
      height: "90%",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      background:
        "radial-gradient(ellipse at top, rgba(59,130,246,0.08), transparent 60%)",
    }}
  >
    <GameStyles />
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        flexShrink: 0,
        borderBottom: "1px solid var(--border-color)",
      }}
    >
      <IconBadge
        icon={<GraduationCap size={16} />}
        color="var(--vscode-textLink-foreground, #3b82f6)"
        bg="rgba(59, 130, 246, 0.12)"
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--vscode-foreground)",
          }}
        >
          Learn English
        </span>
        <span style={labelStyle}>Practice while the AI works</span>
      </div>
      <div style={{ marginLeft: "auto" }}>
        <AiStatus isProcessing={isProcessing} />
      </div>
    </div>
    <div
      className="zg-scroll"
      style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px" }}
    >
      <div
        className="zg-enter"
        style={{ maxWidth: "720px", margin: "0 auto", width: "100%" }}
      >
        <EnglishGame />
      </div>
    </div>
  </div>
);

export default GameOverlay;