/**
 * ------------------------------------------------------------------
 * InstallationBanner
 * ------------------------------------------------------------------
 * Banner hiển thị yêu cầu cài đặt AIWeb2API backend.
 * Layout đơn giản: nền color-opacity, không shadow, không animation.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";

// ─── Component ──────────────────────────────────────────────────────────
const InstallationBanner: React.FC = () => {
  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: "8px",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.3)",
        width: "100%",
        marginBottom: "20px",
        boxSizing: "border-box",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "var(--vscode-textLink-activeForeground, #3b82f6)",
          marginBottom: "6px",
          letterSpacing: "0.3px",
        }}
      >
        Installation Required
      </div>
      <div
        style={{
          fontSize: "12.5px",
          color: "var(--vscode-foreground)",
          lineHeight: "1.5",
        }}
      >
        Zen requires{" "}
        <a
          href="https://github.com/KhanhRomVN/AIWeb2API"
          target="_blank"
          style={{
            color: "var(--vscode-textLink-activeForeground, #3b82f6)",
            textDecoration: "none",
            fontWeight: 700,
            borderBottom: "2px solid rgba(59, 130, 246, 0.4)",
            paddingBottom: "1px",
          }}
        >
          AIWeb2API
        </a>{" "}
        backend running. Make sure AIWeb2API is installed and running before
        using Zen.
      </div>
    </div>
  );
};

export default InstallationBanner;
