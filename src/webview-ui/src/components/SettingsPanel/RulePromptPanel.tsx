import React, { useState, useEffect } from "react";
import { DEFAULT_RULE_PROMPT } from "./defaultRulePrompt";

interface RulePromptPanelProps {
  onBack: () => void;
}

const RulePromptPanel: React.FC<RulePromptPanelProps> = ({ onBack }) => {
  const [rulePrompt, setRulePrompt] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load saved rule prompt from localStorage
    const saved = localStorage.getItem("zen-rule-prompt");
    if (saved) {
      setRulePrompt(saved);
    } else {
      setRulePrompt(DEFAULT_RULE_PROMPT);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("zen-rule-prompt", rulePrompt);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);

    // Send to VS Code extension
    const vscodeApi = (window as any).acquireVsCodeApi?.();
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "updateRulePrompt",
        rulePrompt: rulePrompt,
      });
    }
  };

  const handleReset = () => {
    setRulePrompt(DEFAULT_RULE_PROMPT);
  };

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
        zIndex: 1001,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div
          style={{
            cursor: "pointer",
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onBack}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </div>
        <h2
          style={{
            fontSize: "var(--font-size-xl)",
            fontWeight: 600,
            color: "var(--primary-text)",
            margin: 0,
          }}
        >
          Rule Prompt
        </h2>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-md)",
        }}
      >
        {/* Editor */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "var(--spacing-md)",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "var(--font-size-md)",
                fontWeight: 600,
                color: "var(--primary-text)",
              }}
            >
              Custom Rule Prompt
            </h3>
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
              }}
            >
              {rulePrompt.length} characters
            </div>
          </div>
          <textarea
            value={rulePrompt}
            onChange={(e) => setRulePrompt(e.target.value)}
            placeholder="Enter your custom rule prompt here..."
            style={{
              flex: 1,
              padding: "var(--spacing-md)",
              backgroundColor: "var(--input-bg)",
              color: "var(--primary-text)",
              border: "none",
              outline: "none",
              fontSize: "var(--font-size-sm)",
              fontFamily: "monospace",
              lineHeight: 1.6,
              resize: "none",
            }}
          />
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
          }}
        >
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              padding: "var(--spacing-sm)",
              backgroundColor: "var(--button-secondary)",
              color: "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--spacing-xs)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: "var(--spacing-sm)",
              backgroundColor: isSaved
                ? "var(--success-color)"
                : "var(--button-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--spacing-xs)",
              transition: "background-color 0.2s",
            }}
          >
            {isSaved ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RulePromptPanel;
