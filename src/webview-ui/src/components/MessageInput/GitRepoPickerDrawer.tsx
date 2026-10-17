import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  GitBranch,
  FolderGit2,
  RefreshCw,
  Search,

  Check,
  CircleDot,
  ArrowUp,
  FileQuestion,
  AlertTriangle,
} from "lucide-react";
import type { GitRepoInfo } from "../../hooks/useGitRepoScanner";

interface GitRepoPickerDrawerProps {
  isOpen: boolean;
  repos: GitRepoInfo[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSelect: (repo: GitRepoInfo) => void;
}

const FILTER_THRESHOLD = 5;

const COLOR = {
  branch: "#a78bfa",
  staged: "#22c55e",
  modified: "#f59e0b",
  untracked: "#94a3b8",
  unpushed: "#3b82f6",
  added: "#34d399",
  deleted: "#f87171",
};

const CARD_COLORS = [
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#14b8a6",
];

interface ChipProps {
  color: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Chip({ color, icon, children }: ChipProps) {
  return (
    <span
      className="grp-chip"
      style={{ ["--c" as string]: color } as React.CSSProperties}
    >
      {icon}
      {children}
    </span>
  );
}

function splitPath(relPath: string) {
  const parts = relPath.split("/").filter((p) => p && p !== ".");
  const name = parts.pop() ?? "(workspace root)";
  return { name, dir: parts.join("/") };
}

export default function GitRepoPickerDrawer({
  isOpen,
  repos,
  loading,
  error,
  onClose,
  onRefresh,
  onSelect,
}: GitRepoPickerDrawerProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.relPath.toLowerCase().includes(q) ||
        (r.branch ?? "").toLowerCase().includes(q),
    );
  }, [repos, query]);

  if (!isOpen) return null;

  const showFilter = repos.length > FILTER_THRESHOLD;
  const isInitialLoading = loading && repos.length === 0;

  const content = (
    <>
      <div className="grp-overlay" onClick={onClose} />
      <div className="grp-sheet" role="dialog" aria-label="Select repository">
        <div className="grp-handle" />

        <div className="grp-header">
          <div className="grp-header-text">
            <div className="grp-title">
              Select repository
              {repos.length > 0 && (
                <span className="grp-count">{repos.length}</span>
              )}
            </div>
            <div className="grp-subtitle">
              Pick a repository with staged changes to generate a commit
              message.
            </div>
          </div>
          <div className="grp-header-actions">
            <button
              type="button"
              className="grp-icon-btn"
              onClick={onRefresh}
              disabled={loading}
              title="Rescan"
              aria-label="Rescan repositories"
            >
              <RefreshCw size={14} className={loading ? "grp-spin" : undefined} />
            </button>
            <button
              type="button"
              className="grp-icon-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="grp-filter">
            <Search size={13} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by path or branch"
              spellCheck={false}
            />
          </div>
        )}

        <div className="grp-list">
          {isInitialLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="grp-skeleton">
                <div className="grp-skeleton-tile" />
                <div className="grp-skeleton-lines">
                  <div className="grp-skeleton-line" style={{ width: "38%" }} />
                  <div className="grp-skeleton-line" style={{ width: "62%" }} />
                </div>
              </div>
            ))}

          {!loading && error && (
            <div className="grp-state grp-state-error">
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && repos.length === 0 && (
            <div className="grp-state">
              <FolderGit2 size={20} />
              <span>No repositories found in the workspace</span>
              <small>Scanned up to 4 levels deep</small>
            </div>
          )}

          {!error && repos.length > 0 && filtered.length === 0 && (
            <div className="grp-state">
              <Search size={20} />
              <span>No repositories match your filter</span>
            </div>
          )}

          {!error &&
            filtered.map((repo, idx) => {
              const { name, dir } = splitPath(repo.relPath);
              const hasChanges =
                repo.staged + repo.unstaged + repo.untracked > 0;
              const isClean = !hasChanges && repo.unpushed === 0;
              const canSelect = repo.staged > 0;
              const cardColor = CARD_COLORS[idx % CARD_COLORS.length];
              return (
                <button
                  key={repo.absPath}
                  type="button"
                  className={`grp-row ${canSelect ? "" : "grp-row-disabled"}`}
                  style={
                    { ["--card" as string]: cardColor } as React.CSSProperties
                  }
                  disabled={!canSelect}
                  title={
                    canSelect ? undefined : "Nothing staged. Run git add first."
                  }
                  onClick={() => {
                    if (canSelect) onSelect(repo);
                  }}
                >
                  <div className="grp-row-icon">
                    <FolderGit2 size={15} />
                  </div>
                  <div className="grp-row-body">
                    <div className="grp-row-top">
                      <span className="grp-name">{name}</span>
                      {dir && <span className="grp-dir">{dir}</span>}
                    </div>
                    <div className="grp-chips">
                      <Chip color={COLOR.branch} icon={<GitBranch size={10} />}>
                        {repo.branch || "detached"}
                      </Chip>
                      {(repo.added > 0 || repo.deleted > 0) && (
                        <span className="grp-diff">
                          <span style={{ color: COLOR.added }}>
                            +{repo.added}
                          </span>
                          <span style={{ color: COLOR.deleted }}>
                            -{repo.deleted}
                          </span>
                        </span>
                      )}
                      {repo.staged > 0 && (
                        <Chip color={COLOR.staged} icon={<Check size={10} />}>
                          {repo.staged} staged
                        </Chip>
                      )}
                      {repo.staged === 0 &&
                        repo.unstaged + repo.untracked > 0 && (
                          <Chip color={COLOR.modified}>Nothing staged</Chip>
                        )}
                      {repo.unstaged > 0 && (
                        <Chip
                          color={COLOR.modified}
                          icon={<CircleDot size={10} />}
                        >
                          {repo.unstaged} modified
                        </Chip>
                      )}
                      {repo.untracked > 0 && (
                        <Chip
                          color={COLOR.untracked}
                          icon={<FileQuestion size={10} />}
                        >
                          {repo.untracked} untracked
                        </Chip>
                      )}
                      {repo.unpushed > 0 && (
                        <Chip
                          color={COLOR.unpushed}
                          icon={<ArrowUp size={10} />}
                        >
                          {repo.unpushed} unpushed
                        </Chip>
                      )}
                      {isClean && <Chip color={COLOR.untracked}>Clean</Chip>}
                    </div>
                  </div>

                </button>
              );
            })}
        </div>
      </div>

      <style>{`
        @keyframes grpSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes grpFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes grpSpin { to { transform: rotate(360deg); } }
        @keyframes grpShimmer { 0% { opacity: .35; } 50% { opacity: .7; } 100% { opacity: .35; } }

        .grp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); backdrop-filter: blur(2px); z-index: 10000; animation: grpFade .16s ease; }
        .grp-sheet { position: fixed; left: 0; right: 0; bottom: 0; height: min(520px, 70%); min-height: 260px; display: flex; flex-direction: column; background: var(--tertiary-bg); border-top: 1px solid var(--border-color); border-radius: 0; box-shadow: 0 -12px 40px rgba(0,0,0,.35); z-index: 10001; animation: grpSlide .26s cubic-bezier(.2,.8,.2,1); }
        .grp-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border-color); margin: 8px auto 0; flex-shrink: 0; opacity: .8; }

        .grp-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .grp-header-text { flex: 1; min-width: 0; }
        .grp-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; letter-spacing: -.01em; color: var(--primary-text); }
        .grp-count { font-size: 10.5px; font-weight: 600; padding: 1px 7px; border-radius: 4px; color: var(--secondary-text); background: var(--hover-bg); }
        .grp-subtitle { margin-top: 2px; font-size: 11.5px; color: var(--secondary-text); opacity: .75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .grp-header-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .grp-icon-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 7px; background: transparent; color: var(--secondary-text); cursor: pointer; flex-shrink: 0; transition: background .12s ease, color .12s ease; }
        .grp-icon-btn:hover:not(:disabled) { background: var(--hover-bg); color: var(--primary-text); }
        .grp-icon-btn:disabled { cursor: wait; opacity: .7; }
        .grp-spin { animation: grpSpin 1s linear infinite; }

        .grp-filter { display: flex; align-items: center; gap: 8px; margin: 10px 12px 0; padding: 0 10px; height: 32px; border-radius: 8px; border: 1px solid var(--border-color); color: var(--secondary-text); flex-shrink: 0; transition: border-color .12s ease; }
        .grp-filter:focus-within { border-color: color-mix(in srgb, #f59e0b 60%, var(--border-color)); }
        .grp-filter input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--primary-text); font-size: 12px; font-family: inherit; }

        .grp-list { flex: 1; overflow-y: auto; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 6px; }

        .grp-row { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: none; outline: none; border-radius: 10px; background: var(--hover-bg); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background .15s ease; }
        .grp-row::before { content: ""; position: absolute; left: 0; top: 10%; height: 80%; width: 3px; border-radius: 0 3px 3px 0; background: var(--card); opacity: 0; transform: scaleY(.4); transition: opacity .15s ease, transform .18s ease; pointer-events: none; }

        .grp-row:not(:disabled):hover::before, .grp-row:not(:disabled):focus-visible::before { opacity: 1; transform: scaleY(1); }
        .grp-row-disabled { background: color-mix(in srgb, var(--hover-bg) 50%, transparent); opacity: .45; cursor: not-allowed; }
        .grp-row-icon { width: 32px; height: 32px; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--primary-text); background: color-mix(in srgb, var(--primary-text) 8%, transparent); }
        .grp-row-disabled .grp-row-icon { color: var(--secondary-text); background: var(--hover-bg); }
        .grp-row-body { flex: 1; min-width: 0; }
        .grp-row-top { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
        .grp-name { font-size: 13px; font-weight: 600; color: var(--primary-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; max-width: 70%; }
        .grp-dir { font-size: 11px; color: var(--secondary-text); opacity: .6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
        .grp-chips { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
        .grp-chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px; height: 18px; font-size: 10.5px; font-weight: 500; border-radius: 4px; white-space: nowrap; color: var(--c); background: color-mix(in srgb, var(--c) 13%, transparent); }
        .grp-diff { display: inline-flex; gap: 5px; font-size: 10.5px; font-weight: 600; font-variant-numeric: tabular-nums; font-family: var(--vscode-editor-font-family, ui-monospace, monospace); padding: 0 2px; }


        .grp-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 40px 16px; text-align: center; font-size: 12px; color: var(--secondary-text); opacity: .8; }
        .grp-state small { font-size: 11px; opacity: .7; }
        .grp-state-error { color: #ef4444; opacity: 1; }

        .grp-skeleton { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
        .grp-skeleton-tile { width: 32px; height: 32px; border-radius: 9px; background: var(--hover-bg); animation: grpShimmer 1.3s ease-in-out infinite; }
        .grp-skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .grp-skeleton-line { height: 9px; border-radius: 5px; background: var(--hover-bg); animation: grpShimmer 1.3s ease-in-out infinite; }
      `}</style>
    </>
  );

  return createPortal(content, document.body);
}