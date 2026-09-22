/**
 * ------------------------------------------------------------------
 * FeatureSettings
 * ------------------------------------------------------------------
 * Tab Feature trong Settings Panel. Được chia thành các GroupSection:
 * - Agent Permission: quyền của agent (approval / fullAccess)
 * - Agent Behavior: checkpoint, VSCode diagnostics, SKILL
 * - Conversation: lưu lịch sử hội thoại, hiển thị MetadataBar
 * ------------------------------------------------------------------
 */

import React from "react";
import { ShieldCheck, Wrench, MessageSquare } from "lucide-react";
import { useSettings } from "../../../context/SettingsContext";
import type { PermissionMode } from "../../chat/types/tag-types";
import GroupSection from "./GroupSection";

const ACCENT = "#1565c0";

const PERMISSION_OPTIONS: {
  value: PermissionMode;
  label: string;
  desc: string;
}[] = [
  {
    value: "approval",
    label: "Ask for approval",
    desc: "The agent must ask for your approval before writing, replacing or deleting files and before running commands.",
  },
  {
    value: "fullAccess",
    label: "Full access",
    desc: "The agent can read, write, delete files and run commands automatically without asking.",
  },
];

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  title,
  description,
  checked,
  onChange,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--primary-text)",
          marginBottom: "2px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "11.5px",
          color: "var(--secondary-text)",
          lineHeight: 1.4,
        }}
      >
        {description}
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "999px",
        border: "none",
        padding: 0,
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        background: checked ? ACCENT : "rgba(128, 128, 128, 0.3)",
        transition: "background 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: "2px",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: "#fff",
          transition: "transform 0.15s ease",
          transform: checked ? "translateX(16px)" : "translateX(0)",
        }}
      />
    </button>
  </div>
);

const FeatureSettings: React.FC = () => {
  const {
    permissionMode,
    setPermissionMode,
    checkpointEnabled,
    setCheckpointEnabled,
    diagnosticEnabled,
    setDiagnosticEnabled,
    showMetadataBar,
    setShowMetadataBar,
    useSkillEnabled,
    setUseSkillEnabled,
  } = useSettings();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "28px",
      }}
    >
      {/* Agent Permission */}
      <GroupSection
        icon={<ShieldCheck size={16} />}
        color="#2e7d32"
        title="Agent Permission"
        description="Choose how much the agent is allowed to do on its own."
      >
        <div
          role="radiogroup"
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          {PERMISSION_OPTIONS.map((option) => {
            const selected = permissionMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPermissionMode(option.value)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor: "var(--input-bg)",
                  border: `1px solid ${selected ? ACCENT : "transparent"}`,
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                  }}
                >
                  {option.label}
                </span>
                <span
                  style={{
                    fontSize: "11.5px",
                    color: "var(--secondary-text)",
                    lineHeight: 1.4,
                  }}
                >
                  {option.desc}
                </span>
              </button>
            );
          })}
        </div>
      </GroupSection>

      {/* Agent Behavior */}
      <GroupSection
        icon={<Wrench size={16} />}
        color="#ef6c00"
        title="Agent Behavior"
        description="Safety net and extra context for the agent."
      >
        <ToggleRow
          title="Create checkpoints"
          description="Automatically create a checkpoint before the agent writes, replaces or deletes files."
          checked={checkpointEnabled}
          onChange={setCheckpointEnabled}
        />
        <ToggleRow
          title="Use VSCode diagnostics"
          description="Fetch errors and warnings from the language server after the agent edits a file."
          checked={diagnosticEnabled}
          onChange={setDiagnosticEnabled}
        />
        <ToggleRow
          title="Use SKILL"
          description="Attach the list of installed skills (name and description) to the system prompt."
          checked={useSkillEnabled}
          onChange={setUseSkillEnabled}
        />
      </GroupSection>

      {/* Conversation */}
      <GroupSection
        icon={<MessageSquare size={16} />}
        color="#00838f"
        title="Conversation"
        description="Response display in the chat."
      >
        <ToggleRow
          title="Show MetadataBar"
          description="Show token usage and response number below each AI response in the chat."
          checked={showMetadataBar}
          onChange={setShowMetadataBar}
        />
      </GroupSection>
    </div>
  );
};

export default FeatureSettings;
