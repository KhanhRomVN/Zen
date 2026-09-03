/**
 * ------------------------------------------------------------------
 * MarketplacePanel
 * ------------------------------------------------------------------
 * Marketplace với 3 tab: LSP, SKILL, MCP
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import { LSPPanel } from "./LSP";
import { SkillPanel } from "./SKILL";
import { MCPPanel } from "./MCP";

interface MarketplacePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MarketplacePanel: React.FC<MarketplacePanelProps> = ({ isOpen, onClose }) => {
  const [closeHover, setCloseHover] = useState(false);
  const [activeTab, setActiveTab] = useState("LSP");

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
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
              <div style={{ marginBottom: "3px" }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "var(--primary-text)",
                    letterSpacing: "0.01em",
                  }}
                >
                  Marketplace
                </span>
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
                Install LSP servers, skills, and MCP servers
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
            title="Close Marketplace"
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

      {/* Tabbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--tertiary-bg)",
          flexShrink: 0,
        }}
      >
        {["LSP", "SKILL", "MCP"].map((tab) => (
          <span
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--primary-text)" : "var(--secondary-text)",
              cursor: "pointer",
              borderBottom: activeTab === tab ? "2px solid var(--vscode-focusBorder, #007acc)" : "2px solid transparent",
              transition: "all 0.15s ease",
              userSelect: "none",
            }}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeTab === "LSP" && <LSPPanel />}
        {activeTab === "SKILL" && <SkillPanel />}
        {activeTab === "MCP" && <MCPPanel />}
      </div>
    </div>
  );
};

export default MarketplacePanel;
