/**
 * FolderPickerDrawer
 *
 * Bottom-sheet drawer để browse và chọn folder trực tiếp từ filesystem
 * thông qua AIWeb2API backend (/v1/fs/list). Thay thế native VSCode dialog
 * vốn không hiển thị system/hidden folders trên Linux.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  X,
  Check,
  Home,
  HardDrive,
} from "lucide-react";
import { useDbFetch } from "../../services/useDbFetch";

interface FolderEntry {
  name: string;
  path: string;
}

interface FsListResponse {
  success: boolean;
  path: string;
  parent: string | null;
  entries: FolderEntry[];
  /** Backend có thể trả về string hoặc object { code, message, ... } */
  error?: string | { code?: string; message?: string; [key: string]: unknown };
}

interface FolderPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  title?: string;
}

const FolderPickerDrawer: React.FC<FolderPickerDrawerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath,
  title = "Select Folder",
}) => {
  const dbFetch = useDbFetch();
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = async (targetPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dbFetch(
        `/v1/fs/list?path=${encodeURIComponent(targetPath)}`,
      );
      const data: FsListResponse = await res.json();
      const safePath = data?.path ?? "";
      const safeParent = data?.parent ?? null;
      const safeEntries = Array.isArray(data?.entries) ? data.entries : [];
      setCurrentPath(safePath);
      setParent(safeParent);
      setEntries(safeEntries);
      setManualInput(safePath);
      if (!data.success && data.error) {
        // data.error có thể là object { code: "..." } hoặc string
        setError(
          typeof data.error === "string"
            ? data.error
            : ((data.error as any)?.message ??
                (data.error as any)?.code ??
                JSON.stringify(data.error)),
        );
      }
      // Scroll list to top on navigation
      if (listRef.current) listRef.current.scrollTop = 0;
    } catch (err: any) {
      setError(
        typeof err?.message === "string"
          ? err.message
          : typeof err === "string"
            ? err
            : "Failed to list directory",
      );
    } finally {
      setLoading(false);
    }
  };

  // Load initial path when drawer opens
  useEffect(() => {
    if (isOpen) {
      navigate(initialPath || "~");
    }
  }, [isOpen]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) navigate(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "55vh",
        maxHeight: "55vh",
        backgroundColor: "var(--tertiary-bg)",
        borderTop: "1px solid var(--border-color)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.25)",
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        animation: "slideUpDrawer 0.22s ease-out",
        color: "var(--primary-text)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        {/* Back button */}
        <button
          onClick={() => parent && navigate(parent)}
          disabled={!parent || loading}
          title="Go up"
          style={{
            background: "transparent",
            border: "none",
            cursor: parent ? "pointer" : "not-allowed",
            padding: "5px",
            borderRadius: "4px",
            color: parent ? "var(--primary-text)" : "var(--secondary-text)",
            display: "flex",
            alignItems: "center",
            opacity: parent ? 1 : 0.35,
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Home button */}
        <button
          onClick={() => navigate("~")}
          disabled={loading}
          title="Home directory"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "5px",
            borderRadius: "4px",
            color: "var(--secondary-text)",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Home size={14} />
        </button>

        {/* Root button */}
        <button
          onClick={() => navigate("/")}
          disabled={loading}
          title="Filesystem root /"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "5px",
            borderRadius: "4px",
            color: "var(--secondary-text)",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <HardDrive size={14} />
        </button>

        {/* Current path input */}
        <form
          onSubmit={handleManualSubmit}
          style={{ flex: 1, display: "flex", gap: "6px" }}
        >
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            style={{
              flex: 1,
              padding: "5px 10px",
              fontSize: "12px",
              backgroundColor: "var(--input-bg)",
              border: "none",
              borderRadius: "6px",
              color: "var(--primary-text)",
              outline: "none",
              fontFamily: "monospace",
            }}
            placeholder="/path/to/folder"
            spellCheck={false}
          />
        </form>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "5px",
            borderRadius: "4px",
            color: "var(--secondary-text)",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Path breadcrumb */}
      <div
        style={{
          padding: "6px 14px",
          fontSize: "11px",
          color: "var(--secondary-text)",
          opacity: 0.65,
          fontFamily: "monospace",
          borderBottom: "1px solid var(--border-color)",
          flexShrink: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <FolderOpen size={12} />
        {loading ? "Loading..." : currentPath || "—"}
      </div>

      {/* Directory listing */}
      <div
        ref={listRef}
        className="custom-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}
      >
        {error && (
          <div
            style={{
              margin: "8px 14px",
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              fontSize: "11px",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}
        {!loading &&
          Array.isArray(entries) &&
          entries.length === 0 &&
          !error && (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--secondary-text)",
                opacity: 0.6,
              }}
            >
              No subdirectories
            </div>
          )}
        {Array.isArray(entries) &&
          entries.map((entry) => (
            <div
              key={entry.path}
              onClick={() => navigate(entry.path)}
              style={{
                padding: "7px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "13px",
                borderRadius: "0",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <Folder size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.name}
              </span>
              <ChevronRight
                size={13}
                style={{
                  color: "var(--secondary-text)",
                  opacity: 0.4,
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
      </div>

      {/* Footer — select current dir */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: "12px",
            color: "var(--secondary-text)",
            fontFamily: "monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentPath || "—"}
        </span>
        <button
          onClick={() => {
            if (currentPath) {
              onSelect(currentPath);
              onClose();
            }
          }}
          disabled={!currentPath || loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: currentPath
              ? "rgba(59,130,246,0.15)"
              : "rgba(128,128,128,0.1)",
            color: currentPath ? "#3b82f6" : "var(--secondary-text)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: currentPath ? "pointer" : "not-allowed",
            flexShrink: 0,
          }}
        >
          <Check size={14} />
          Select
        </button>
      </div>

      <style>{`
        @keyframes slideUpDrawer {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default FolderPickerDrawer;
