/**
 * ------------------------------------------------------------------
 * FeatureSettings
 * ------------------------------------------------------------------
 * Tab Feature trong Settings Panel
 * Bao gồm: Custom LSP Diagnostic toggle
 * ------------------------------------------------------------------
 */

import React from "react";
import { useSettings } from "../../../context/SettingsContext";

const FeatureSettings: React.FC = () => {
  const { useCustomLSP, setUseCustomLSP } = useSettings();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Custom LSP Diagnostic Toggle */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--primary-text)",
          }}
        >
          LSP Diagnostic Mode
        </label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px",
            backgroundColor: "var(--tertiary-bg)",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              flex: 1,
            }}
          >
            <input
              type="checkbox"
              checked={useCustomLSP}
              onChange={(e) => setUseCustomLSP(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                marginRight: "12px",
                cursor: "pointer",
                accentColor: "var(--vscode-focusBorder, #007acc)",
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--primary-text)",
                }}
              >
                Use Custom LSP Diagnostic
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                  marginTop: "2px",
                }}
              >
                {useCustomLSP
                  ? "Using custom LSP servers from Marketplace"
                  : "Using VSCode extension LSP diagnostics"}
              </div>
            </div>
          </label>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--secondary-text)",
            opacity: 0.7,
            marginTop: "2px",
          }}
        >
          {useCustomLSP
            ? "Custom LSP servers will be automatically installed and used for diagnostics. You can manage them in the Marketplace."
            : "Standard VSCode extension LSP diagnostics will be used."}
        </div>
      </div>
    </div>
  );
};

export default FeatureSettings;
