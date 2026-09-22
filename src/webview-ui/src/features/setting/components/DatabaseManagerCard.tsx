/**
 * ------------------------------------------------------------------
 * DatabaseManagerCard
 * ------------------------------------------------------------------
 * CardUI hiển thị một database manager. Click card để chọn làm database
 * active của workspace.
 * - Badge icon: local-file dùng <Database /> màu primary; connection
 *   dùng logo engine (postgresql/mysql/mariadb/mongodb.svg).
 * - Active: badge "Active" soft-style, line primary ở mép trái, nền primary
 *   nhạt, không outline.
 * - Dot trạng thái: xanh (ok), đỏ (lỗi), vàng (đang kiểm tra).
 * - Hover hiện icon Test / Edit / Delete. Right-click mở menu (thêm
 *   Open Folder / Create & Open Folder cho local-file).
 * Trạng thái kiểm tra do component cha quản lý (prop `status`).
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import {
  Database,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plug,
  Server,
  Trash2,
} from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { useDbFetch } from "../../../services/useDbFetch";
import { extensionService } from "../../../services/ExtensionService";
import type { DatabaseManagerPayload, DbType } from "./DatabaseManagerDrawer";
import ConfirmDeleteDatabaseManagerDrawer from "./ConfirmDeleteDatabaseManagerDrawer";

export interface DatabaseManagerRow
  extends Omit<DatabaseManagerPayload, "icon" | "color"> {
  id: string;
  icon: string | null;
  color: string | null;
  last_test_status: string | null;
  last_test_at: number | null;
}

export type DbStatusState = "idle" | "checking" | "ok" | "error";

/** Trạng thái kết nối của một manager (do component cha kiểm tra). */
export interface DbStatus {
  state: DbStatusState;
  message?: string;
}

interface DatabaseManagerCardProps {
  manager: DatabaseManagerRow;
  /** Manager này đang là database active của workspace */
  active: boolean;
  /** Backend có route được engine này hay không (xem isRoutable) */
  routable: boolean;
  status: DbStatus;
  onSelect: (manager: DatabaseManagerRow) => void;
  onEdit: (manager: DatabaseManagerRow) => void;
  onTest: (manager: DatabaseManagerRow) => void;
  /** Gọi sau khi xóa thành công để cha reload danh sách */
  onChanged: () => void;
}

const PRIMARY = "var(--vscode-button-background, #0e639c)";
const PRIMARY_SOFT = `color-mix(in srgb, ${PRIMARY} 15%, transparent)`;
const TEXT_SOFT = "color-mix(in srgb, var(--primary-text) 12%, transparent)";

const STATUS_COLOR: Record<DbStatusState, string> = {
  ok: "var(--vscode-testing-iconPassed, #3fb950)",
  error: "var(--vscode-errorForeground, #f85149)",
  checking: "var(--vscode-editorWarning-foreground, #e3b341)",
  idle: "var(--secondary-text)",
};

/** File logo trong images/database_icons theo db_type của connection. */
const DB_ICON_FILES: Partial<Record<DbType, string>> = {
  postgres: "postgresql.svg",
  mysql: "mysql.svg",
  mariadb: "mariadb.svg",
  mongodb: "mongodb.svg",
};

const statusTitle = (s: DbStatus): string => {
  switch (s.state) {
    case "ok":
      return "Connected";
    case "error":
      return s.message ? `Failed — ${s.message}` : "Failed";
    case "checking":
      return "Checking…";
    default:
      return "Not checked yet";
  }
};

/** Icon button nhỏ hiện khi hover card. */
const IconAction: React.FC<{
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, danger, disabled, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    style={{
      width: "24px",
      height: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      borderRadius: "6px",
      background: "transparent",
      color: "var(--secondary-text)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "all 0.12s ease",
    }}
    onMouseEnter={(e) => {
      if (disabled) return;
      e.currentTarget.style.backgroundColor = danger
        ? "rgba(244,67,54,0.15)"
        : "rgba(128,128,128,0.18)";
      e.currentTarget.style.color = danger ? "#f44336" : "var(--primary-text)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "transparent";
      e.currentTarget.style.color = "var(--secondary-text)";
    }}
  >
    {children}
  </button>
);

const DatabaseManagerCard: React.FC<DatabaseManagerCardProps> = ({
  manager,
  active,
  routable,
  status,
  onSelect,
  onEdit,
  onTest,
  onChanged,
}) => {
  const dbFetch = useDbFetch();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const target =
    manager.type === "local-file"
      ? (manager.file_path ?? "?")
      : `${manager.host ?? "?"}${
          manager.port ? ":" + manager.port : ""
        }/${manager.database_name ?? "?"}`;

  // Badge: local-file → Database icon (primary); connection → logo engine.
  const iconFile =
    manager.type === "connection" && manager.db_type
      ? DB_ICON_FILES[manager.db_type]
      : undefined;
  const imagesBase = (window as any).__zenImagesUri || "/images";
  let badgeBg = PRIMARY_SOFT;
  let badgeNode: React.ReactNode;
  if (iconFile) {
    badgeBg = TEXT_SOFT;
    badgeNode = (
      <img
        src={`${imagesBase}/database_icons/${iconFile}`}
        alt={manager.db_type}
        width={18}
        height={18}
        draggable={false}
        style={{ objectFit: "contain" }}
      />
    );
  } else if (manager.type === "local-file") {
    badgeNode = <Database size={16} color={PRIMARY} />;
  } else {
    // Engine chưa có logo (VD: mssql) → icon Server mặc định
    badgeNode = <Server size={16} color={PRIMARY} />;
  }

  const dotColor = STATUS_COLOR[status.state];
  const showActions = hovered || focused;

  const handleSelect = () => {
    if (routable) onSelect(manager);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ top: e.clientY, left: e.clientX });
    setMenuOpen(true);
  };

  const openContainerFolder = () => {
    if (!manager.file_path) return;
    // Lấy thư mục chứa file rồi mở trong OS file manager
    const folder =
      manager.file_path.replace(/[/\\][^/\\]+$/, "") || manager.file_path;
    extensionService.postMessage({ command: "openPath", path: folder });
  };

  const createAndOpenContainerFolder = () => {
    if (!manager.file_path) return;
    // Tạo thư mục chứa file (nếu chưa tồn tại) rồi mở trong OS file manager
    const folder =
      manager.file_path.replace(/[/\\][^/\\]+$/, "") || manager.file_path;
    extensionService.postMessage({
      command: "createFolderAndOpen",
      path: folder,
    });
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await dbFetch(`/v1/database-managers/${manager.id}`, {
        method: "DELETE",
      });
      setConfirmDeleteOpen(false);
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        role="radio"
        aria-checked={active}
        aria-disabled={!routable}
        tabIndex={0}
        title={routable ? undefined : "Not routable yet"}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelect();
          }
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 10px 10px 14px",
          borderRadius: "8px",
          border: "none",
          outline: "none",
          backgroundColor: active
            ? PRIMARY_SOFT
            : hovered
              ? "color-mix(in srgb, var(--primary-text) 8%, var(--input-bg))"
              : "var(--input-bg)",
          cursor: routable ? "pointer" : "default",
          transition: "background-color 0.14s ease",
        }}
      >
        {/* Line primary ở mép trái khi active */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            width: "3px",
            height: "60%",
            borderRadius: "0 3px 3px 0",
            backgroundColor: PRIMARY,
            transform: `translateY(-50%) scaleY(${active ? 1 : 0.2})`,
            opacity: active ? 1 : 0,
            transition: "opacity 0.16s ease, transform 0.16s ease",
            pointerEvents: "none",
          }}
        />

        {/* Badge icon */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: badgeBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: routable ? 1 : 0.65,
          }}
        >
          {badgeNode}
        </div>

        {/* Main */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            opacity: routable ? 1 : 0.65,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              minWidth: 0,
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
              {manager.name}
            </span>
            {active && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "10px",
                  fontWeight: 600,
                  lineHeight: 1.5,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: PRIMARY_SOFT,
                  color: PRIMARY,
                }}
              >
                Active
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              minWidth: 0,
            }}
          >
            <span
              title={statusTitle(status)}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                flexShrink: 0,
                backgroundColor: dotColor,
                opacity: status.state === "idle" ? 0.5 : 1,
                boxShadow:
                  status.state === "idle"
                    ? "none"
                    : `0 0 0 3px color-mix(in srgb, ${dotColor} 15%, transparent)`,
                animation:
                  status.state === "checking"
                    ? "dbDotPulse 1s ease-in-out infinite"
                    : "none",
              }}
            />
            <span
              title={target}
              style={{
                fontSize: "10.5px",
                fontFamily:
                  "var(--vscode-editor-font-family, ui-monospace, monospace)",
                color: "var(--secondary-text)",
                opacity: 0.8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {target}
            </span>
          </div>
          {status.state === "error" && status.message && (
            <span
              title={status.message}
              style={{
                fontSize: "11px",
                color: STATUS_COLOR.error,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {status.message}
            </span>
          )}
        </div>

        {/* Hover actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1px",
            flexShrink: 0,
            opacity: showActions ? 1 : 0,
            pointerEvents: showActions ? "auto" : "none",
            transition: "opacity 0.14s ease",
          }}
        >
          <IconAction
            title="Test connection"
            disabled={status.state === "checking"}
            onClick={() => onTest(manager)}
          >
            <Plug size={14} />
          </IconAction>
          <IconAction title="Edit" onClick={() => onEdit(manager)}>
            <Pencil size={14} />
          </IconAction>
          <IconAction
            title="Delete"
            danger
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 size={14} />
          </IconAction>
        </div>
      </div>

      {/* Right-click menu */}
      <Dropdown
        open={menuOpen}
        onOpenChange={setMenuOpen}
        trigger="contextmenu"
        strategy="fixed"
        position={menuPos}
      >
        <DropdownTrigger asChild>
          <span style={{ display: "none" }} />
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem icon={<Plug size={14} />} onClick={() => onTest(manager)}>
            Test connection
          </DropdownItem>
          {manager.type === "local-file" && manager.file_path && (
            <DropdownItem
              icon={<FolderOpen size={14} />}
              onClick={openContainerFolder}
            >
              Open Folder
            </DropdownItem>
          )}
          {manager.type === "local-file" && (
            <DropdownItem
              icon={<FolderPlus size={14} />}
              onClick={createAndOpenContainerFolder}
            >
              Create & Open Folder
            </DropdownItem>
          )}
          <DropdownItem
            icon={<Pencil size={14} />}
            onClick={() => onEdit(manager)}
          >
            Edit
          </DropdownItem>
          <DropdownItem
            icon={<Trash2 size={14} />}
            variant="error"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            Delete
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      <ConfirmDeleteDatabaseManagerDrawer
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={remove}
        loading={deleting}
        managerName={manager.name}
      />

      <style>{`
        @keyframes dbDotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </>
  );
};

export default DatabaseManagerCard;