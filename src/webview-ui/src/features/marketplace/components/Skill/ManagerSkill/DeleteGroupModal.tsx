import React, { useState } from "react";
import { X } from "lucide-react";
import type { SkillSummary } from "../../../types/skill.types";
import { DEFAULT_GROUP_NAME } from "../../../hooks/useSkillWorkspaceState";

interface DeleteGroupModalProps {
  groupName: string;
  groupSkills: SkillSummary[];
  otherGroups: string[];
  onCancel: () => void;
  onConfirm: (options: { deleteSlugs: string[]; moveTo?: string }) => void;
}

/**
 * Modal xóa group — cho user chọn từng skill: xóa hẳn hoặc chuyển sang
 * group khác (bao gồm "Other"). Chỉ những skill không được chọn sẽ bị xóa.
 */
export function DeleteGroupModal({
  groupName,
  groupSkills,
  otherGroups,
  onCancel,
  onConfirm,
}: DeleteGroupModalProps) {
  // Mặc định: tất cả đều move sang Other (không xóa gì)
  const [deleteSet, setDeleteSet] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState<string>(DEFAULT_GROUP_NAME);

  const toggleDelete = (slug: string) => {
    setDeleteSet((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "440px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--tertiary-bg)",
          borderRadius: "10px",
          border: "1px solid var(--border-color)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Delete group "{groupName}"
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--secondary-text)",
              cursor: "pointer",
              display: "flex",
              padding: "2px",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Move target */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--secondary-text)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "6px",
            }}
          >
            Move remaining skills to
          </label>
          <select
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            style={{
              width: "100%",
              fontSize: "12px",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
              color: "var(--primary-text)",
              outline: "none",
            }}
          >
            <option value={DEFAULT_GROUP_NAME}>{DEFAULT_GROUP_NAME}</option>
            {otherGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Skill list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 16px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--secondary-text)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "4px 0 8px",
            }}
          >
            Skills in this group — check to delete permanently
          </div>
          {groupSkills.length === 0 ? (
            <div
              style={{
                fontSize: "12px",
                color: "var(--secondary-text)",
                padding: "12px 0",
                textAlign: "center",
              }}
            >
              No skills in this group
            </div>
          ) : (
            groupSkills.map((s) => {
              const willDelete = deleteSet.has(s.slug);
              return (
                <label
                  key={s.slug}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 4px",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={willDelete}
                    onChange={() => toggleDelete(s.slug)}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: "12px",
                      color: willDelete
                        ? "var(--vscode-errorForeground, #f87171)"
                        : "var(--primary-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--secondary-text)",
                      opacity: 0.7,
                    }}
                  >
                    {willDelete ? "delete" : `move → ${moveTo}`}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "12px 16px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "transparent",
              color: "var(--primary-text)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({ deleteSlugs: Array.from(deleteSet), moveTo })
            }
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--vscode-errorForeground, #dc2626)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Delete group
          </button>
        </div>
      </div>
    </div>
  );
}