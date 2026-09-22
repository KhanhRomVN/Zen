import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface RuleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Gọi khi người dùng lưu rule mới; đóng drawer + gắn rule vào input do caller xử lý. */
  onSave: (name: string, content: string) => Promise<void>;
}

/** Drawer tạo mới 1 Rule: nhập tên + nội dung, lưu vào ~/.khanhromvn-zen/rules.json. */
const RuleDrawer: React.FC<RuleDrawerProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Reset form mỗi lần mở drawer
  useEffect(() => {
    if (isOpen) {
      setName("");
      setContent("");
      setError(null);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const canSave = name.trim().length > 0 && content.trim().length > 0 && !isSaving;

  const handleSaveClick = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), content);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: "13px",
    backgroundColor: "var(--vscode-input-background, #3c3c3c)",
    border: "1px solid var(--vscode-input-border, transparent)",
    borderRadius: "6px",
    color: "var(--vscode-input-foreground, #fff)",
    outline: "none",
    boxSizing: "border-box",
  };

  const drawerContent = (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 99998,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "80vh",
          backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.3)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom:
              "1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3))",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--vscode-foreground, #fff)",
              }}
            >
              New Rule
            </h3>
            <div
              style={{
                fontSize: "11px",
                color: "var(--vscode-descriptionForeground, #888)",
              }}
            >
              Saved to ~/.khanhromvn-zen/rules.json
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              borderRadius: "4px",
              color: "var(--vscode-foreground, #fff)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--vscode-foreground, #fff)",
              }}
            >
              Rule name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vietnamese comments only"
              style={inputStyle}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: 1,
              minHeight: "160px",
            }}
          >
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--vscode-foreground, #fff)",
              }}
            >
              Rule content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the rule the agent must follow..."
              style={{
                ...inputStyle,
                flex: 1,
                minHeight: "160px",
                resize: "vertical",
                fontFamily:
                  "var(--vscode-editor-font-family, 'Courier New', monospace)",
                lineHeight: 1.5,
              }}
            />
          </div>
          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--vscode-errorForeground, #f44336)",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "12px 16px",
            borderTop:
              "1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3))",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.4))",
              backgroundColor: "transparent",
              color: "var(--vscode-foreground, #fff)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={!canSave}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--vscode-button-background)",
              color: "var(--vscode-button-foreground)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.6,
            }}
          >
            {isSaving ? "Saving..." : "Save & Attach"}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(drawerContent, document.body);
};

export default RuleDrawer;