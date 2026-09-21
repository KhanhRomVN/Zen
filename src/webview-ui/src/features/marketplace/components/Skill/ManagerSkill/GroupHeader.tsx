import React, { useState } from "react";
import { ChevronRight, ChevronDown, Pencil, Trash2, Check, X } from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../../components/ui/Dropdown";
import { isReservedGroupName } from "../../../hooks/useSkillWorkspaceState";

interface GroupHeaderProps {
  name: string;
  count: number;
  collapsed: boolean;
  /** Cho phép rename/delete hay không (group "Others" thì không). */
  editable: boolean;
  onToggleCollapse: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * Header của 1 group skill — tên + badge số lượng ở bên phải, click trái
 * để expand/collapse, chuột phải mở context menu rename/delete. Cũng là
 * drop target cho drag & drop skill vào group.
 */
export function GroupHeader({
  name,
  count,
  collapsed,
  editable,
  onToggleCollapse,
  onRename,
  onDelete,
  onDragOver,
  onDrop,
}: GroupHeaderProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [dragOver, setDragOver] = useState(false);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (!trimmed || isReservedGroupName(trimmed)) {
      setDraft(name);
      setEditing(false);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  };

  const cancelRename = () => {
    setDraft(name);
    setEditing(false);
  };

  const content = editing ? (
    <div
      style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          else if (e.key === "Escape") cancelRename();
        }}
        style={{
          flex: 1,
          fontSize: "12px",
          padding: "3px 6px",
          borderRadius: "4px",
          border: "1px solid var(--border-color)",
          backgroundColor: "var(--input-bg)",
          color: "var(--primary-text)",
          outline: "none",
        }}
      />
      <button
        type="button"
        onClick={commitRename}
        title="Confirm"
        style={{
          border: "none",
          background: "transparent",
          color: "var(--vscode-charts-green, #22c55e)",
          cursor: "pointer",
          padding: "2px",
          display: "flex",
        }}
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={cancelRename}
        title="Cancel"
        style={{
          border: "none",
          background: "transparent",
          color: "var(--secondary-text)",
          cursor: "pointer",
          padding: "2px",
          display: "flex",
        }}
      >
        <X size={14} />
      </button>
    </div>
  ) : (
    <>
      <span style={{ flexShrink: 0, display: "flex", opacity: 0.7 }}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </span>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--primary-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
          }}
        >
          {name}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: "11px",
            color: "var(--secondary-text)",
            backgroundColor: "rgba(128,128,128,0.18)",
            borderRadius: "4px",
            padding: "1px 8px",
            minWidth: "20px",
            textAlign: "center",
          }}
        >
          {count}
        </span>
      </div>
    </>
  );

  return (
    <Dropdown trigger="contextmenu" align="start" side="bottom">
      <DropdownTrigger asChild>
        <div
          onClick={editing ? undefined : onToggleCollapse}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOver(true);
            onDragOver(e);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            setDragOver(false);
            onDrop(e);
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 12px",
            cursor: editing ? "default" : "pointer",
            backgroundColor: dragOver
              ? "color-mix(in srgb, var(--vscode-button-background) 25%, transparent)"
              : hovered
                ? "var(--hover-bg)"
                : "transparent",
            borderRadius: "6px",
            transition: "background-color 0.15s ease",
            userSelect: "none",
          }}
        >
          {content}
        </div>
      </DropdownTrigger>
      {editable && (
        <DropdownContent>
          <DropdownItem
            icon={<Pencil size={14} />}
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            Rename group
          </DropdownItem>
          <DropdownItem
            icon={<Trash2 size={14} />}
            variant="error"
            onClick={onDelete}
          >
            Delete group
          </DropdownItem>
        </DropdownContent>
      )}
    </Dropdown>
  );
}