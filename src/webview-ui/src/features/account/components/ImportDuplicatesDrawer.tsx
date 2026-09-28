/**
 * ------------------------------------------------------------------
 * ImportReviewDrawer (formerly ImportDuplicatesDrawer)
 * ------------------------------------------------------------------
 * Hiển thị toàn bộ accounts từ file import để user review và confirm
 * trước khi insert/override vào DB.
 *
 * Entry kinds:
 * - new      : chưa có trong DB → sẽ được insert
 * - changed  : cùng email+provider, credential khác → sẽ override
 * - identical: cùng email+provider, credential giống → bỏ qua
 *
 * Auto-tick: new + changed được tick sẵn. Identical không tick.
 * ------------------------------------------------------------------
 */

import React, { useState, useMemo } from "react";
import { Loader2, CheckSquare, Square, Check, X, Search } from "lucide-react";
import { getFaviconUrl } from "@/utils/favicon";

// ─── Types ──────────────────────────────────────────────────────────────
export interface DuplicateEntry {
  email: string;
  provider_id: string;
  kind?: "new" | "changed" | "identical";
  incoming: {
    id?: string;
    email: string;
    provider_id: string;
    credential?: string;
    [key: string]: any;
  };
  existing: {
    id: string;
    email: string;
    provider_id: string;
    credential: string | null;
    usage: number | null;
    reset_usage_at: string | null;
  } | null;
}

interface ProviderConfig {
  provider_id: string;
  provider_name: string;
  website?: string;
}

interface ImportDuplicatesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateEntry[];
  providerConfigs: ProviderConfig[];
  onOverride: (entries: DuplicateEntry[]) => Promise<void>;
  onDone: () => void;
}

type FilterTab = "all" | "new" | "changed" | "identical";

// ─── Helpers ────────────────────────────────────────────────────────────
function summarizeCredential(raw: string | null | undefined): string {
  if (!raw) return "\u2014";
  try {
    const obj = JSON.parse(raw);
    const key = obj.accessToken || obj.access_token || obj.token || obj.cookie;
    if (key) {
      const s = String(key);
      return s.length > 32 ? `${s.slice(0, 12)}\u2026${s.slice(-8)}` : s;
    }
    const first = Object.keys(obj)[0];
    if (first) {
      const s = String(obj[first]);
      return `${first}: ${s.length > 24 ? s.slice(0, 12) + "\u2026" : s}`;
    }
    return raw.length > 32 ? `${raw.slice(0, 12)}\u2026${raw.slice(-8)}` : raw;
  } catch {
    return raw.length > 32 ? `${raw.slice(0, 12)}\u2026${raw.slice(-8)}` : raw;
  }
}

function credentialsDiffer(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const normalize = (v: string | null | undefined) => {
    if (!v) return null;
    try { return JSON.stringify(JSON.parse(v)); }
    catch { return v; }
  };
  return normalize(a) !== normalize(b);
}

function getKind(entry: DuplicateEntry): "new" | "changed" | "identical" {
  if (entry.kind) return entry.kind;
  if (!entry.existing) return "new";
  return credentialsDiffer(entry.existing.credential, entry.incoming.credential)
    ? "changed"
    : "identical";
}

// ─── DiffRow ─────────────────────────────────────────────────────────────
const DiffRow: React.FC<{
  label: string;
  existing: string;
  incoming: string;
  changed: boolean;
}> = ({ label, existing, incoming, changed }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "60px 1fr 1fr",
    gap: "6px", alignItems: "start",
    padding: "4px 0", borderBottom: "1px solid var(--border-color)",
  }}>
    <span style={{
      fontSize: "10px", fontWeight: 600, color: "var(--secondary-text)",
      textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: "1px",
    }}>{label}</span>
    <div style={{
      fontSize: "11px", fontFamily: "var(--vscode-editor-font-family, monospace)",
      color: changed ? "var(--vscode-errorForeground, #f87171)" : "var(--secondary-text)",
      wordBreak: "break-all",
      backgroundColor: changed ? "rgba(239,68,68,0.06)" : "transparent",
      borderRadius: "4px", padding: "2px 4px",
    }}>{existing || "\u2014"}</div>
    <div style={{
      fontSize: "11px", fontFamily: "var(--vscode-editor-font-family, monospace)",
      color: changed ? "var(--vscode-charts-green, #4ade80)" : "var(--secondary-text)",
      wordBreak: "break-all",
      backgroundColor: changed ? "rgba(74,222,128,0.06)" : "transparent",
      borderRadius: "4px", padding: "2px 4px",
    }}>{incoming || "\u2014"}</div>
  </div>
);

// ─── EntryCard ────────────────────────────────────────────────────────
const EntryCard: React.FC<{
  entry: DuplicateEntry;
  selected: boolean;
  onToggle: () => void;
  providerConfig?: ProviderConfig;
}> = ({ entry, selected, onToggle, providerConfig }) => {
  const [expanded, setExpanded] = useState(false);

  const kind = getKind(entry);
  const faviconUrl = providerConfig?.website ? getFaviconUrl(providerConfig.website) : null;

  const badgeCfg =
    kind === "new"
      ? { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", label: "New" }
      : kind === "changed"
        ? { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "Changed" }
        : { bg: "rgba(128,128,128,0.1)", color: "var(--secondary-text)", label: "Identical" };

  const credChanged = kind === "changed";
  const diffCount = credChanged ? 1 : 0;

  return (
    <div style={{
      backgroundColor: selected
        ? "color-mix(in srgb, var(--vscode-list-activeSelectionBackground, #3b82f6) 10%, var(--input-bg))"
        : "var(--input-bg)",
      border: selected
        ? "1.5px solid color-mix(in srgb, var(--vscode-focusBorder, #3b82f6) 60%, transparent)"
        : "1.5px solid transparent",
      borderRadius: "12px",
      transition: "all 0.15s ease",
      flexShrink: 0, overflow: "hidden",
    }}>
      {/* Main row */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 12px", cursor: "pointer",
      }} onClick={onToggle}>

        <span style={{
          color: selected ? "var(--vscode-focusBorder, #3b82f6)" : "var(--secondary-text)",
          flexShrink: 0,
        }}>
          {selected ? <CheckSquare size={15} /> : <Square size={15} />}
        </span>

        <div style={{
          width: "32px", height: "32px", borderRadius: "8px",
          backgroundColor: "rgba(128,128,128,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
        }}>
          {faviconUrl ? (
            <img src={faviconUrl} alt={providerConfig?.provider_name}
              style={{ width: "20px", height: "20px", objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--secondary-text)" }}>
              {(providerConfig?.provider_name || entry.provider_id).charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: "13px", fontWeight: 500,
            color: "var(--primary-text)", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            <span style={{ fontWeight: 600 }}>{providerConfig?.provider_name || entry.provider_id}</span>
            <span style={{ color: "var(--secondary-text)", margin: "0 4px" }}>|</span>
            <span style={{ color: "var(--secondary-text)" }}>{entry.email}</span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
            <span style={{
              fontSize: "10px", fontWeight: 600,
              padding: "1px 6px", borderRadius: "4px",
              backgroundColor: badgeCfg.bg, color: badgeCfg.color,
              whiteSpace: "nowrap", flexShrink: 0,
            }}>{badgeCfg.label}</span>
            {diffCount > 0 && (
              <span style={{ fontSize: "10px", color: "var(--secondary-text)", opacity: 0.5 }}>
                {diffCount} field diff
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          style={{
            padding: "3px", borderRadius: "4px", border: "none",
            backgroundColor: "transparent", color: "var(--secondary-text)",
            cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0,
            transition: "transform 0.15s ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Detail */}
      {expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--input-bg)" }}>
          {kind === "new" ? (
            /* New: show incoming data only */
            <div style={{ paddingTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                { label: "Email", value: entry.incoming.email },
                { label: "Credential", value: summarizeCredential(entry.incoming.credential) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "6px", alignItems: "start" }}>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, color: "var(--secondary-text)",
                    textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: "2px",
                  }}>{label}</span>
                  <div style={{
                    fontSize: "11px", fontFamily: "var(--vscode-editor-font-family, monospace)",
                    color: "var(--secondary-text)", wordBreak: "break-all", padding: "2px 4px",
                  }}>{value || "\u2014"}</div>
                </div>
              ))}
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--secondary-text)", opacity: 0.5, textAlign: "center" }}>
                Will be inserted as a new account.
              </p>
            </div>
          ) : kind === "identical" ? (
            /* Identical: view-only */
            <div style={{ paddingTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                { label: "Email", value: entry.existing?.email ?? "" },
                { label: "Credential", value: summarizeCredential(entry.existing?.credential) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "6px", alignItems: "start" }}>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, color: "var(--secondary-text)",
                    textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: "2px",
                  }}>{label}</span>
                  <div style={{
                    fontSize: "11px", fontFamily: "var(--vscode-editor-font-family, monospace)",
                    color: "var(--secondary-text)", wordBreak: "break-all", padding: "2px 4px",
                  }}>{value || "\u2014"}</div>
                </div>
              ))}
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--secondary-text)", opacity: 0.5, textAlign: "center" }}>
                No differences \u2014 overriding will have no effect.
              </p>
            </div>
          ) : (
            /* Changed: diff view */
            <>
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: "6px", padding: "8px 0 4px" }}>
                <span />
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--secondary-text)", opacity: 0.6 }}>Existing (DB)</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--secondary-text)", opacity: 0.6 }}>Incoming (file)</span>
              </div>
              <DiffRow
                label="Email"
                existing={entry.existing?.email ?? ""}
                incoming={entry.incoming.email}
                changed={false}
              />
              <DiffRow
                label="Credential"
                existing={summarizeCredential(entry.existing?.credential)}
                incoming={summarizeCredential(entry.incoming.credential)}
                changed={credChanged}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────
const ImportDuplicatesDrawer: React.FC<ImportDuplicatesDrawerProps> = ({
  open,
  onOpenChange,
  duplicates,
  providerConfigs,
  onOverride,
  onDone,
}) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Auto-tick new + changed khi mở
  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setActiveTab("all");
    const auto = new Set<number>();
    duplicates.forEach((entry, i) => {
      const k = getKind(entry);
      if (k === "new" || k === "changed") auto.add(i);
    });
    setSelected(auto);
  }, [open, duplicates]);

  const providerMap = useMemo(
    () => new Map(providerConfigs.map((p) => [p.provider_id, p])),
    [providerConfigs],
  );

  const classified = useMemo(
    () => duplicates.map((entry, i) => ({ entry, i, kind: getKind(entry) })),
    [duplicates],
  );

  const tabCounts = useMemo(() => ({
    all: classified.length,
    new: classified.filter((c) => c.kind === "new").length,
    changed: classified.filter((c) => c.kind === "changed").length,
    identical: classified.filter((c) => c.kind === "identical").length,
  }), [classified]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classified.filter(({ entry, kind }) => {
      if (activeTab !== "all" && kind !== activeTab) return false;
      if (!q) return true;
      const pName = providerMap.get(entry.provider_id)?.provider_name ?? entry.provider_id;
      return entry.email.toLowerCase().includes(q) || pName.toLowerCase().includes(q);
    });
  }, [classified, activeTab, search, providerMap]);

  const toggle = (i: number) => {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i); else s.add(i);
    setSelected(s);
  };

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const toProcess = [...selected].map((i) => duplicates[i]);
      await onOverride(toProcess);
      onDone();
      onOpenChange(false);
    } catch (err) {
      console.error("Import confirm failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const TABS: { key: FilterTab; label: string; color?: string }[] = [
    { key: "all",       label: "All" },
    { key: "new",       label: "New",       color: "#60a5fa" },
    { key: "changed",   label: "Changed",   color: "#fbbf24" },
    { key: "identical", label: "Identical" },
  ];

  const selectedNew     = [...selected].filter((i) => getKind(duplicates[i]) === "new").length;
  const selectedChanged = [...selected].filter((i) => getKind(duplicates[i]) === "changed").length;

  const confirmLabel = loading
    ? "Importing\u2026"
    : selected.size === 0
      ? "Select accounts to import"
      : [
          selectedNew     > 0 ? `${selectedNew} new`         : "",
          selectedChanged > 0 ? `${selectedChanged} override` : "",
        ].filter(Boolean).join(", ");

  return (
    <>
      <div style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 200, animation: "idFadeIn 0.15s ease",
      }} onClick={() => !loading && onOpenChange(false)} />

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "75vh",
        backgroundColor: "var(--tertiary-bg)",
        borderTop: "1px solid var(--border-color)",
        borderRadius: 0,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
        zIndex: 201, animation: "idSlideUp 0.22s ease",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", borderBottom: "1px solid var(--border-color)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--primary-text)", letterSpacing: "0.01em" }}>
              Review Import
            </span>
            <span style={{ fontSize: "11px", color: "var(--secondary-text)", opacity: 0.7 }}>
              {duplicates.length} account{duplicates.length !== 1 ? "s" : ""} &mdash; select which to import
            </span>
          </div>
          <button
            onClick={() => !loading && onOpenChange(false)}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: "6px", borderRadius: "4px", color: "var(--secondary-text)",
              display: "flex", alignItems: "center", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(244,67,54,0.15)"; e.currentTarget.style.color = "#f44336"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--secondary-text)"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ padding: "10px 16px 8px", flexShrink: 0, borderBottom: "1px solid var(--border-color)" }}>
          {/* Searchbar */}
          <div style={{ position: "relative", marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="Search by email or provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px 8px 32px",
                fontSize: "13px", backgroundColor: "var(--input-bg)",
                border: "none", borderRadius: "8px",
                color: "var(--primary-text)", outline: "none",
                boxSizing: "border-box", height: "34px",
              }}
            />
            <Search style={{
              width: "14px", height: "14px", position: "absolute",
              left: "10px", top: "50%", transform: "translateY(-50%)",
              color: "var(--secondary-text)", pointerEvents: "none",
            }} />
            {search && (
              <button onClick={() => setSearch("")} style={{
                position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                border: "none", background: "transparent", padding: "2px",
                cursor: "pointer", display: "flex", color: "var(--secondary-text)", opacity: 0.5,
              }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {TABS.map(({ key, label, color }) => {
              const isActive = activeTab === key;
              const count = tabCounts[key as keyof typeof tabCounts];
              const activeColor = color ?? "var(--primary-text)";
              return (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  padding: "4px 10px", borderRadius: "6px", border: "none",
                  fontSize: "12px", fontWeight: isActive ? 600 : 500, cursor: "pointer",
                  backgroundColor: isActive
                    ? color ? `${color}20` : "rgba(128,128,128,0.18)"
                    : color ? `${color}0d` : "rgba(128,128,128,0.08)",
                  color: isActive ? activeColor : color ? `${color}99` : "var(--secondary-text)",
                  display: "flex", alignItems: "center", gap: "5px",
                  transition: "all 0.12s ease", whiteSpace: "nowrap",
                }}>
                  {label}
                  {count > 0 && (
                    <span style={{
                      fontSize: "10px", fontWeight: 700, padding: "0 5px", borderRadius: "4px",
                      backgroundColor: isActive
                        ? color ? `${color}30` : "rgba(128,128,128,0.25)"
                        : "rgba(128,128,128,0.12)",
                      color: isActive ? activeColor : color ? `${color}99` : "var(--secondary-text)",
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "10px 16px",
          display: "flex", flexDirection: "column", gap: "6px", minHeight: 0,
        }}>
          {filtered.length === 0 ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", color: "var(--secondary-text)", opacity: 0.5, padding: "24px 0",
            }}>No accounts match</div>
          ) : (
            filtered.map(({ entry, i }) => (
              <EntryCard
                key={`${entry.provider_id}-${entry.email}`}
                entry={entry}
                selected={selected.has(i)}
                onToggle={() => toggle(i)}
                providerConfig={providerMap.get(entry.provider_id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px 16px", flexShrink: 0,
          borderTop: "1px solid var(--border-color)", display: "flex", gap: "8px",
        }}>
          <button
            onClick={() => { onOpenChange(false); onDone(); }}
            disabled={loading}
            style={{
              flex: 1, padding: "9px", borderRadius: "9px",
              backgroundColor: "rgba(128,128,128,0.08)", border: "none",
              color: "var(--secondary-text)", fontSize: "12px", fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1, whiteSpace: "nowrap",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={loading || selected.size === 0}
            style={{
              flex: 2, padding: "9px", borderRadius: "9px",
              backgroundColor: selected.size === 0 ? "rgba(128,128,128,0.08)" : "rgba(34,197,94,0.12)",
              border: "none",
              color: selected.size === 0 ? "var(--secondary-text)" : "var(--vscode-testing-iconPassed, #22c55e)",
              fontSize: "12px", fontWeight: 600,
              cursor: loading || selected.size === 0 ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : selected.size === 0 ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              transition: "all 0.15s ease", whiteSpace: "nowrap",
            }}
          >
            {loading
              ? <Loader2 size={13} style={{ animation: "idSpin 1s linear infinite" }} />
              : <Check size={13} />
            }
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes idSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes idFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes idSpin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default ImportDuplicatesDrawer;
