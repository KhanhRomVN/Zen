/**
 * ------------------------------------------------------------------
 * FeatureSettings
 * ------------------------------------------------------------------
 * Tab Feature trong Settings Panel. Được chia thành các GroupSection:
 * - Agent Permission: quyền của agent (approval / fullAccess)
 * - Conversation: hiển thị MetadataBar
 * ------------------------------------------------------------------
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { ShieldCheck, MessageSquare, Brain, RefreshCw } from "lucide-react";
import { useSettings } from "../../../../context/SettingsContext";
import type { PermissionMode } from "../../../chat/types/tag-types";
import GroupSection from "../database/GroupSection";
import { extensionService } from "@/services/ExtensionService";

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

const MemoryViewer: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debounce state for auto-save
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await extensionService.getMemorySnapshot();
      setContent(snapshot || "");
      isDirtyRef.current = false;
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || "Failed to load memory file.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleChange = (newValue: string) => {
    setContent(newValue);
    isDirtyRef.current = true;
    setStatus('idle'); // Reset status khi đang gõ

    // Debounce save: Chờ 1s sau khi user dừng gõ mới gửi request
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    debounceTimerRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      
      setStatus('saving');
      try {
        const result = await extensionService.saveMemory(newValue);
        if (!result.success) {
          throw new Error(result.error || "Failed to save memory file.");
        }
        isDirtyRef.current = false;
        setStatus('saved');
        // Ẩn thông báo "Saved" sau 2s
        setTimeout(() => {
          setStatus((prev) => prev === 'saved' ? 'idle' : prev);
        }, 2000);
      } catch (e: any) {
        setStatus('error');
        console.error("[MemoryViewer] Save failed:", e);
      }
    }, 1000);
  };

  if (!enabled) {
    return (
      <div
        style={{
          fontSize: "11.5px",
          color: "var(--secondary-text)",
          fontStyle: "italic",
          padding: "8px 0",
        }}
      >
        Bật Memory để xem và chỉnh sửa nội dung file memory.md.
      </div>
    );
  }

  const getStatusColor = () => {
    if (status === 'saving') return "#fbbf24"; // Amber/Yellow
    if (status === 'saved') return "#4ade80"; // Green
    if (status === 'error') return "#f87171"; // Red
    return "var(--secondary-text)"; // Gray idle
  };

  const getStatusText = () => {
    if (status === 'saving') return "Saving...";
    if (status === 'saved') return "Saved";
    if (status === 'error') return "Save Error";
    return "";
  };

  const placeholderText = "# Project Memory\n\n- User prefers dark mode.\n- Use TypeScript for new components.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", color: "var(--secondary-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          memory.md
        </span>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Status Indicator */}
          <span 
            style={{ 
              fontSize: "10px", 
              fontWeight: 600, 
              color: getStatusColor(),
              opacity: status !== 'idle' ? 1 : 0,
              transition: "opacity 0.2s"
            }}
          >
            {getStatusText()}
          </span>
          
          <button
            type="button"
            onClick={load}
            disabled={loading || status === 'saving'}
            title="Reload from disk"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "transparent",
              border: "none",
              cursor: (loading || status === 'saving') ? "wait" : "pointer",
              color: "var(--secondary-text)",
              fontSize: "11px",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : undefined }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: "11.5px", color: "var(--vscode-errorForeground, #f87171)" }}>
          {error}
        </div>
      )}
      
      {/* Single Editable Textarea - Always visible when enabled */}
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        placeholder={placeholderText}
        style={{
          width: "100%",
          minHeight: "150px",
          maxHeight: "300px",
          resize: "vertical",
          padding: "10px 12px",
          fontSize: "11.5px",
          lineHeight: 1.5,
          fontFamily: "var(--vscode-editor-font-family, monospace)",
          color: "var(--primary-text)",
          backgroundColor: "var(--input-bg, rgba(128,128,128,0.06))",
          border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
          borderRadius: "6px",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
      />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const FeatureSettings: React.FC = () => {
  const {
    permissionMode,
    setPermissionMode,
    showMetadataBar,
    setShowMetadataBar,
    memoryEnabled,
    setMemoryEnabled,
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

      {/* Memory */}
      <GroupSection
        icon={<Brain size={16} />}
        color="#a855f7"
        title="Memory"
        description="Persist durable facts (preferences, conventions) across conversations within this project."
      >
        <ToggleRow
          title="Enable project memory"
          description="When on, the full content of memory.md is injected into every system prompt. The agent can read/update it via read_memory / update_memory tools."
          checked={memoryEnabled}
          onChange={setMemoryEnabled}
        />
        <MemoryViewer enabled={memoryEnabled} />
      </GroupSection>
    </div>
  );
};

export default FeatureSettings;
