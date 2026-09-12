/**
 * ------------------------------------------------------------------
 * Skill Panel
 * ------------------------------------------------------------------
 * Browse skills từ mcp.directory.
 *
 * Main features:
 * - Leaderboard: hiển thị danh sách skill theo lượt xem (mặc định)
 * - Search: tìm kiếm skill theo query text
 * - Detail: xem thông tin chi tiết skill khi click vào card
 * ------------------------------------------------------------------
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  ArrowLeft,
  Eye,
  Download,
  PackageOpen,
} from "lucide-react";

import { SkillSummary, SkillDetail } from "./types";
import {
  fetchLeaderboard,
  searchSkills,
  fetchSkillDetail,
} from "./skill.service";

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function SkillPanel() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLeaderboard();
      setSkills(data);
    } catch (err: any) {
      setError(err.message || "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) return;
      setSearchLoading(true);
      setError(null);
      try {
        const result = await searchSkills(searchQuery.trim());
        setSkills(result.skills);
      } catch (err: any) {
        setError(err.message || "Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleBack = () => {
    setSelectedSkill(null);
    setDetailError(null);
  };

  const handleSkillClick = async (skill: SkillSummary) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedSkill(null);
    try {
      const detail = await fetchSkillDetail(skill.slug);
      setSelectedSkill(detail);
    } catch (err: any) {
      setDetailError(err.message || "Failed to load skill detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    loadLeaderboard();
  };

  // ── Detail View ──
  if (selectedSkill) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "rgba(128,128,128,0.1)",
              color: "var(--secondary-text)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <ArrowLeft size={14} />
            Back to skills
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--primary-text)",
              marginBottom: "6px",
            }}
          >
            {selectedSkill.name}
          </h3>
          {selectedSkill.description && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--secondary-text)",
                marginBottom: "16px",
                lineHeight: 1.5,
              }}
            >
              {selectedSkill.description}
            </p>
          )}
          <div
            style={{
              borderTop: "1px solid var(--border-color)",
              paddingTop: "12px",
            }}
          >
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "12px",
                lineHeight: 1.6,
                color: "var(--primary-text)",
                fontFamily:
                  "var(--vscode-editor-font-family, 'JetBrains Mono', monospace)",
                backgroundColor: "transparent",
                margin: 0,
                padding: 0,
              }}
            >
              {selectedSkill.content}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail Loading ──
  if (detailLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "8px",
          color: "var(--secondary-text)",
          fontSize: "13px",
        }}
      >
        <RefreshCw size={16} className="spin" />
        Loading skill detail...
      </div>
    );
  }

  // ── Detail Error ──
  if (detailError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "8px",
          color: "var(--secondary-text)",
          fontSize: "13px",
          textAlign: "center",
          padding: "32px 16px",
        }}
      >
        <p style={{ color: "var(--vscode-errorForeground, #f48771)" }}>
          {detailError}
        </p>
        <button
          onClick={handleBack}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "rgba(128,128,128,0.1)",
            color: "var(--secondary-text)",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Back to skills
        </button>
      </div>
    );
  }

  // ── List View ──
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Search bar */}
      <div
        style={{
          padding: "8px 16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "10px",
              color: "var(--secondary-text)",
              opacity: 0.6,
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 32px 7px 32px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
              color: "var(--primary-text)",
              fontSize: "12px",
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              style={{
                position: "absolute",
                right: "8px",
                padding: "2px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--secondary-text)",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
              }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "8px",
              color: "var(--secondary-text)",
              fontSize: "13px",
            }}
          >
            <RefreshCw size={16} className="spin" />
            Loading skills...
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "var(--vscode-errorForeground, #f48771)",
                fontSize: "13px",
                maxWidth: "320px",
              }}
            >
              {error}
            </p>
            <button
              onClick={loadLeaderboard}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--vscode-button-background, #0e639c)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          skills.length === 0 &&
          !searchQuery.trim() && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "8px",
                color: "var(--secondary-text)",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              <PackageOpen size={32} style={{ opacity: 0.3 }} />
              No skills found
            </div>
          )}

        {!loading &&
          !error &&
          skills.length === 0 &&
          searchQuery.trim() &&
          !searchLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "8px",
                color: "var(--secondary-text)",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              <Search size={32} style={{ opacity: 0.3 }} />
              No results for "{searchQuery}"
            </div>
          )}

        {/* Skill grid */}
        {!loading && !error && skills.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "10px",
            }}
          >
            {skills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => handleSkillClick(skill)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--tertiary-bg)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--vscode-focusBorder, #007acc)";
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.backgroundColor =
                    "var(--tertiary-bg)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--primary-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {skill.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--secondary-text)",
                      opacity: 0.7,
                      flexShrink: 0,
                      marginLeft: "8px",
                    }}
                  >
                    {skill.author}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--secondary-text)",
                    lineHeight: 1.5,
                    margin: "0 0 10px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as any,
                    overflow: "hidden",
                  }}
                >
                  {skill.description || "No description available"}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "11px",
                    color: "var(--secondary-text)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Eye size={12} />
                    {formatNumber(skill.views)}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Download size={12} />
                    {formatNumber(skill.installs)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}