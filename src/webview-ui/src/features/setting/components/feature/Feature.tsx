/**
 * ------------------------------------------------------------------
 * FeatureSettings
 * ------------------------------------------------------------------
 * Tab Feature trong Settings Panel:
 * - Conversation: hiển thị MetadataBar
 * - Memory: bật/tắt global memory + chỉnh sửa memory.md (auto-save)
 * ------------------------------------------------------------------
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageSquare,
  Brain,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useSettings } from "../../../../context/SettingsContext";
import { extensionService } from "@/services/ExtensionService";
import { SectionCard, ToggleRow, StatusChip } from "../shared/ui";

const TEAL = "#2dd4bf";
const VIOLET = "#a78bfa";

const PLACEHOLDER =
  "# Global Memory\n\n- User prefers dark mode.\n- Prefers TypeScript and concise code.";

const MemoryViewer: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await extensionService.getMemorySnapshot();
      setContent(snapshot || "");
      isDirtyRef.current = false;
      setStatus("idle");
    } catch (e: any) {
      setError(e?.message || "Failed to load memory file.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleChange = (newValue: string) => {
    setContent(newValue);
    isDirtyRef.current = true;
    setStatus("idle");

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;

      setStatus("saving");
      try {
        const result = await extensionService.saveMemory(newValue);
        if (!result.success) {
          throw new Error(result.error || "Failed to save memory file.");
        }
        isDirtyRef.current = false;
        setStatus("saved");
        setTimeout(() => {
          setStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2000);
      } catch (e: any) {
        setStatus("error");
        console.error("[MemoryViewer] Save failed:", e);
      }
    }, 1000);
  };

  if (!enabled) {
    return (
      <span className="zs-hint" style={{ fontStyle: "italic" }}>
        Bật Memory để xem và chỉnh sửa nội dung file memory.md.
      </span>
    );
  }

  const lineCount = content ? content.split("\n").length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          minHeight: "28px",
        }}
      >
        <span
          className="zs-mono"
          style={{
            fontSize: "13.5px",
            fontWeight: 600,
            color: "var(--secondary-text)",
            letterSpacing: "0.04em",
          }}
        >
          ~/.khanhromvn-zen/memory.md
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {status === "saving" && (
            <StatusChip
              color="#fbbf24"
              icon={<Loader2 size={12} className="zs-spin" />}
            >
              Saving...
            </StatusChip>
          )}
          {status === "saved" && (
            <StatusChip color="#4ade80" icon={<CheckCircle2 size={12} />}>
              Saved
            </StatusChip>
          )}
          {status === "error" && (
            <StatusChip color="#f87171" icon={<AlertCircle size={12} />}>
              Save Error
            </StatusChip>
          )}
          <button
            type="button"
            className="zs-icon-btn"
            onClick={load}
            disabled={loading || status === "saving"}
            title="Reload from disk"
          >
            <RefreshCw size={13} className={loading ? "zs-spin" : undefined} />
          </button>
        </div>
      </div>

      {error && (
        <span
          className="zs-hint"
          style={{ color: "var(--vscode-errorForeground, #f87171)", opacity: 1 }}
        >
          {error}
        </span>
      )}

      <textarea
        className="zs-input zs-textarea zs-mono"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        placeholder={PLACEHOLDER}
      />

      <span className="zs-hint" style={{ textAlign: "right" }}>
        {lineCount} lines · {content.length} chars · auto-saved
      </span>
    </div>
  );
};

const FeatureSettings: React.FC = () => {
  const { showMetadataBar, setShowMetadataBar, memoryEnabled, setMemoryEnabled } =
    useSettings();

  return (
    <div className="zs-stack">
      <SectionCard
        icon={<MessageSquare size={17} />}
        accent={TEAL}
        title="Conversation"
        description="Response display in the chat."
      >
        <ToggleRow
          title="Show MetadataBar"
          description="Show token usage and response number below each AI response in the chat."
          checked={showMetadataBar}
          onChange={setShowMetadataBar}
        />
      </SectionCard>

      <SectionCard
        icon={<Brain size={17} />}
        accent={VIOLET}
        title="Memory"
        description="Preferences and coding style, shared across projects."
      >
        <ToggleRow
          title="Enable global memory"
          description="Inject memory.md into every prompt. The agent can read and update it."
          checked={memoryEnabled}
          onChange={setMemoryEnabled}
        />
        <MemoryViewer enabled={memoryEnabled} />
      </SectionCard>
    </div>
  );
};

export default FeatureSettings;