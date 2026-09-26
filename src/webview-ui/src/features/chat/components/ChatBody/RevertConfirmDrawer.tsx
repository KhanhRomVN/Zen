/**
 * ------------------------------------------------------------------
 * RevertConfirmDrawer
 * ------------------------------------------------------------------
 * Bottom-sheet drawer xác nhận revert conversation về điểm này.
 * UI dựa theo mockup: impact bar, grouped files (restore/undo/remove),
 * collapsible groups, search.
 *
 * Clicking a file row opens a preview in the editor:
 *   - restore  (delete_file)             → temp tab with restored content
 *   - remove   (create_file/write_to_file) → temp tab with current content
 *   - undo     (replace_in_file / …)     → diff view (after revert ↔ current)
 * ------------------------------------------------------------------
 */

import React from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Loader2 } from "lucide-react";
import { getFileIconPath } from "@/utils/fileIconMapper";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RevertFileEntry {
  filePath: string;
  actionType: string;
  additions: number;
  deletions: number;
}

type GroupKey = "restore" | "undo" | "remove";

interface GroupDef {
  key: GroupKey;
  name: string;
  desc: string;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
}

interface RevertConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  messageId?: string;
  conversationId?: string;
  /** @deprecated unused, kept for backward compat */
  title?: string;
  /** @deprecated unused, kept for backward compat */
  description?: string;
}

// ─── Group definitions ───────────────────────────────────────────────────────

const ACCENT_RESTORE = "#4FD1C0";
const ACCENT_UNDO    = "#F0A857";
const ACCENT_REMOVE  = "#F0687A";

const GROUP_DEFS: GroupDef[] = [
  {
    key: "restore",
    name: "Will be restored",
    desc: "Files deleted after this point",
    accentColor: ACCENT_RESTORE,
    accentBg: "rgba(79,209,192,0.12)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>
      </svg>
    ),
  },
  {
    key: "undo",
    name: "Edits will be undone",
    desc: "Files modified after this point",
    accentColor: ACCENT_UNDO,
    accentBg: "rgba(240,168,87,0.12)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-1"/>
      </svg>
    ),
  },
  {
    key: "remove",
    name: "Will be removed",
    desc: "Files created after this point",
    accentColor: ACCENT_REMOVE,
    accentBg: "rgba(240,104,122,0.12)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>
      </svg>
    ),
  },
];

function classifyFile(entry: RevertFileEntry): GroupKey {
  if (entry.actionType === "delete_file") return "restore";
  if (entry.actionType === "write_to_file" || entry.actionType === "create_file") return "remove";
  return "undo"; // replace_in_file, rename_file, move_file, etc.
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
  >
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

// ─── FileRow ─────────────────────────────────────────────────────────────────

const FileRow: React.FC<{
  entry: RevertFileEntry;
  groupKey: GroupKey;
  accentColor: string;
  query: string;
  borderTop: boolean;
  conversationId?: string;
}> = ({ entry, groupKey, accentColor, query, borderTop, conversationId }) => {
  const { filePath, additions, deletions, actionType } = entry;
  const slashIdx = filePath.lastIndexOf("/");
  const dirPart  = slashIdx >= 0 ? filePath.slice(0, slashIdx + 1) : "";
  const namePart = slashIdx >= 0 ? filePath.slice(slashIdx + 1) : filePath;
  const isUndo   = groupKey === "undo";

  const [hovered, setHovered] = React.useState(false);

  const handleClick = () => {
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) return;
    vscodeApi.postMessage({
      command: "openRevertFilePreview",
      filePath,
      actionType: groupKey,   // "restore" | "undo" | "remove"
      conversationId,
    });
  };

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: "rgba(124,147,240,0.35)", color: "inherit", borderRadius: "2px" }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 14px 8px 48px",
        borderTop: borderTop ? "1px solid var(--border-color, rgba(255,255,255,0.06))" : "none",
        cursor: "pointer",
        backgroundColor: hovered ? "rgba(255,255,255,0.04)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {/* File icon */}
      <img
        src={getFileIconPath(namePart)}
        alt=""
        width={15}
        height={15}
        style={{ flexShrink: 0, objectFit: "contain" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />

      {/* Path */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "11.5px",
            color: "var(--primary-text, var(--vscode-foreground))",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ color: "var(--secondary-text, var(--vscode-descriptionForeground))", opacity: 0.6 }}>
            {highlight(dirPart)}
          </span>
          {highlight(namePart)}
        </div>
        {isUndo && (additions > 0 || deletions > 0) && (
          <div style={{ fontSize: "10.5px", color: "var(--secondary-text, var(--vscode-descriptionForeground))", marginTop: "1px" }}>
            {additions > 0 && <span style={{ color: "#4FD1C0" }}>+{additions} </span>}
            {deletions > 0 && <span style={{ color: "#F0687A" }}>−{deletions} lines</span>}
          </div>
        )}
      </div>

      {/* Preview hint icon — only visible on hover */}
      <div
        style={{
          opacity: hovered ? 0.5 : 0,
          transition: "opacity 0.1s",
          color: "var(--secondary-text, var(--vscode-descriptionForeground))",
          flexShrink: 0,
        }}
      >
        {isUndo ? (
          /* diff icon */
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h4"/><path d="M15 7h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4"/><path d="M12 2v20"/>
          </svg>
        ) : (
          /* eye icon */
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </div>
    </div>
  );
};

// ─── Group ───────────────────────────────────────────────────────────────────

const FileGroup: React.FC<{
  def: GroupDef;
  files: RevertFileEntry[];
  query: string;
  forceOpen: boolean;
  conversationId?: string;
}> = ({ def, files, query, forceOpen, conversationId }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

  if (files.length === 0) return null;

  return (
    <div
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "var(--input-bg)",
        marginBottom: "8px",
      }}
    >
      {/* Header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "11px 14px",
          cursor: "pointer",
          userSelect: "none",
          transition: "background 0.12s",
        }}
      >
        {/* Group icon badge */}
        <div
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            backgroundColor: def.accentBg,
            color: def.accentColor,
          }}
        >
          {def.icon}
        </div>

        {/* Label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--primary-text, var(--vscode-foreground))" }}>
            {def.name}
          </div>
          <div style={{ fontSize: "11px", color: "var(--secondary-text, var(--vscode-descriptionForeground))", opacity: 0.7, marginTop: "1px" }}>
            {def.desc}
          </div>
        </div>

        {/* Chevron */}
        <div style={{ color: "var(--secondary-text, var(--vscode-descriptionForeground))", opacity: 0.5 }}>
          <ChevronIcon open={open} />
        </div>
      </div>

      {/* File rows — collapse/expand */}
      <div
        style={{
          maxHeight: open ? "260px" : "0",
          overflowY: open ? "auto" : "hidden",
          transition: "max-height 0.22s ease",
        }}
      >
        {files.map((f) => (
          <FileRow
            key={f.filePath}
            entry={f}
            groupKey={def.key}
            accentColor={def.accentColor}
            query={query}
            borderTop={true}
            conversationId={conversationId}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const RevertConfirmDrawer: React.FC<RevertConfirmDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  messageId,
  conversationId,
}) => {
  const [files, setFiles]     = React.useState<RevertFileEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery]     = React.useState("");
  const [reverting, setReverting] = React.useState(false);

  // Fetch file list when drawer opens
  React.useEffect(() => {
    if (!isOpen || !messageId) return;

    setFiles([]);
    setQuery("");
    setReverting(false);
    setLoading(true);

    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) { setLoading(false); return; }

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.command === "revertPreviewResult" && data?.messageId === messageId) {
        setFiles(data.files || []);
        setLoading(false);
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);

    vscodeApi.postMessage({ command: "getRevertPreview", conversationId, messageId });

    const timeout = setTimeout(() => {
      setLoading(false);
      window.removeEventListener("message", handler);
    }, 4000);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
    };
  }, [isOpen, messageId, conversationId]);

  if (!isOpen) return null;

  // Group files
  const grouped: Record<GroupKey, RevertFileEntry[]> = { restore: [], undo: [], remove: [] };
  const lq = query.toLowerCase();
  files.forEach(f => {
    if (!lq || f.filePath.toLowerCase().includes(lq)) {
      grouped[classifyFile(f)].push(f);
    }
  });

  const totalFiltered = grouped.restore.length + grouped.undo.length + grouped.remove.length;
  const totalAll = files.length;

  // Impact bar widths
  const counts = { restore: grouped.restore.length, undo: grouped.undo.length, remove: grouped.remove.length };
  const pct = (n: number) => totalFiltered > 0 ? `${(n / totalFiltered) * 100}%` : "0%";

  const hasSearch = query.length > 0;

  const handleConfirm = () => {
    setReverting(true);
    setTimeout(() => {
      onClose();
      onConfirm();
    }, 300);
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", zIndex: 9998, animation: "rcFadeIn 0.18s ease" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "70%",
          backgroundColor: "var(--tertiary-bg, var(--vscode-editorWidget-background, #15171D))",
          borderTop: "1px solid var(--border-color, var(--vscode-widget-border))",
          borderTopLeftRadius: "0",
          borderTopRightRadius: "0",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.28)",
          zIndex: 9999,
          animation: "rcSlideUp 0.22s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "99px", backgroundColor: "var(--border-color, rgba(255,255,255,0.15))" }} />
        </div>

        {/* Scrollable body */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: "4px 20px 0", minHeight: 0 }}
          className="rc-scroll"
        >
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "8px 8px 16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                marginBottom: "12px",
                backgroundColor: "color-mix(in srgb, var(--vscode-button-background) 12%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--vscode-button-background)",
              }}
            >
              <RotateCcw size={20} />
            </div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--primary-text, var(--vscode-foreground))", letterSpacing: "-0.01em", marginBottom: "6px" }}>
              Revert to this point?
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--secondary-text, var(--vscode-descriptionForeground))", lineHeight: 1.55, maxWidth: "320px", opacity: 0.85 }}>
              The conversation will return to the state before this message. Messages and changes after this point cannot be recovered.
            </div>
          </div>

          {/* Impact summary */}
          {!loading && totalAll > 0 && (
            <div
              style={{
                background: "var(--input-bg)",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--primary-text, var(--vscode-foreground))" }}>
                  {totalAll} file{totalAll !== 1 ? "s" : ""} affected{" "}
                  <span style={{ fontWeight: 400, color: "var(--secondary-text, var(--vscode-descriptionForeground))", opacity: 0.6 }}>· since this message</span>
                </div>
              </div>
              {/* Bar */}
              <div style={{ display: "flex", height: "5px", borderRadius: "99px", overflow: "hidden", backgroundColor: "var(--border-color, rgba(255,255,255,0.08))", marginBottom: "10px" }}>
                <div style={{ width: pct(counts.restore), background: ACCENT_RESTORE, transition: "width 0.3s ease" }} />
                <div style={{ width: pct(counts.undo),    background: ACCENT_UNDO,    transition: "width 0.3s ease" }} />
                <div style={{ width: pct(counts.remove),  background: ACCENT_REMOVE,  transition: "width 0.3s ease" }} />
              </div>
              {/* Legend */}
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                {[
                  { label: "restore", count: counts.restore, color: ACCENT_RESTORE },
                  { label: "undo",    count: counts.undo,    color: ACCENT_UNDO },
                  { label: "remove",  count: counts.remove,  color: ACCENT_REMOVE },
                ].map(l => l.count > 0 && (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--secondary-text, var(--vscode-descriptionForeground))" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "99px", background: l.color, flexShrink: 0 }} />
                    {l.count} {l.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          {!loading && totalAll > 3 && (
            <div style={{ position: "relative", marginBottom: "10px" }}>
              <div style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: "var(--secondary-text, var(--vscode-descriptionForeground))", opacity: 0.5, pointerEvents: "none" }}>
                <SearchIcon />
              </div>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter by filename…"
                style={{
                  width: "100%",
                  height: "34px",
                  background: "var(--input-bg)",
                  border: "none",
                  borderRadius: "8px",
                  color: "var(--primary-text, var(--vscode-foreground))",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  padding: "0 32px 0 32px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {hasSearch && (
                <button
                  onClick={() => setQuery("")}
                  style={{
                    position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)",
                    width: "18px", height: "18px", border: "none", background: "none",
                    color: "var(--secondary-text, var(--vscode-descriptionForeground))",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "4px", padding: 0,
                  }}
                >
                  <XIcon />
                </button>
              )}
            </div>
          )}

          {/* File groups */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "28px 0", color: "var(--secondary-text, var(--vscode-descriptionForeground))", fontSize: "12px", opacity: 0.6 }}>
              <Loader2 size={14} style={{ animation: "rcSpin 1s linear infinite" }} />
              Loading affected files…
            </div>
          ) : totalAll === 0 ? (
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--secondary-text, var(--vscode-descriptionForeground))", opacity: 0.45, padding: "24px 8px" }}>
              No file changes to revert
            </div>
          ) : totalFiltered === 0 ? (
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--secondary-text, var(--vscode-descriptionForeground))", opacity: 0.45, padding: "16px 8px" }}>
              No files match "{query}"
            </div>
          ) : (
            <div style={{ paddingBottom: "8px" }}>
              {GROUP_DEFS.map(def => (
                <FileGroup
                  key={def.key}
                  def={def}
                  files={grouped[def.key]}
                  query={query}
                  forceOpen={hasSearch}
                  conversationId={conversationId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            gap: "8px",
            padding: "12px 16px 16px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: "9px",
              backgroundColor: "color-mix(in srgb, var(--vscode-foreground) 8%, transparent)",
              border: "none",
              color: "var(--secondary-text, var(--vscode-descriptionForeground))",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--vscode-foreground) 13%, transparent)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--vscode-foreground) 8%, transparent)")}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={reverting}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: "9px",
              backgroundColor: reverting
                ? "color-mix(in srgb, var(--vscode-button-background) 14%, transparent)"
                : "color-mix(in srgb, var(--vscode-button-background) 22%, transparent)",
              border: "none",
              color: reverting
                ? "color-mix(in srgb, var(--vscode-button-background) 50%, transparent)"
                : "var(--vscode-button-background)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: reverting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => { if (!reverting) (e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--vscode-button-background) 30%, transparent)"); }}
            onMouseLeave={e => { if (!reverting) (e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--vscode-button-background) 22%, transparent)"); }}
          >
            {reverting
              ? <Loader2 size={13} style={{ animation: "rcSpin 0.7s linear infinite" }} />
              : (
                <>
                  <RotateCcw size={12} />
                  Revert
                </>
              )
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes rcSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes rcFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes rcSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .rc-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
        .rc-scroll::-webkit-scrollbar { width: 5px; }
        .rc-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
      `}</style>
    </>,
    document.body,
  );
};

export default RevertConfirmDrawer;
