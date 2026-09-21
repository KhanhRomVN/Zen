/**
 * ------------------------------------------------------------------
 * DatabaseManagerCard
 * ------------------------------------------------------------------
 * CardUI hiển thị một database manager. Dòng 1: tên (badge icon + màu).
 * Dòng 2: thông tin DB (ẩn password/username). Right-click mở dropdown
 * menu: Test connection / Sửa / Xóa. Sửa sẽ chuyển card thành form ngay
 * tại chỗ.
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import {
  CheckCircle2,
  Database,
  HardDrive,
  Server,
  Boxes,
  Table,
  Table2,
  Folder,
  FolderOpen,
  FolderPlus,
  Archive,
  Cloud,
  Cylinder,
  FileSpreadsheet,
  Network,
  Pencil,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { useDbFetch } from "../../../services/useDbFetch";
import { extensionService } from "../../../services/ExtensionService";
import DatabaseManagerForm, {
  DatabaseManagerPayload,
} from "./DatabaseManagerForm";
import ConfirmDeleteDatabaseManagerDrawer from "./ConfirmDeleteDatabaseManagerDrawer";

export interface DatabaseManagerRow
  extends Omit<DatabaseManagerPayload, "icon" | "color"> {
  id: string;
  icon: string | null;
  color: string | null;
  last_test_status: string | null;
  last_test_at: number | null;
}

interface DatabaseManagerCardProps {
  manager: DatabaseManagerRow;
  onChanged: () => void;
}

const ICON_KEYS = [
  "database",
  "hard-drive",
  "server",
  "boxes",
  "table",
  "table-2",
  "folder",
  "archive",
  "cloud",
  "cylinder",
  "file-spreadsheet",
  "network",
] as const;

/** Map key icon → node lucide. Key không khớp → fallback Database. */
const renderIcon = (key: string) => {
  switch (key) {
    case "hard-drive":
      return <HardDrive size={16} />;
    case "server":
      return <Server size={16} />;
    case "boxes":
      return <Boxes size={16} />;
    case "table":
      return <Table size={16} />;
    case "table-2":
      return <Table2 size={16} />;
    case "folder":
      return <Folder size={16} />;
    case "archive":
      return <Archive size={16} />;
    case "cloud":
      return <Cloud size={16} />;
    case "cylinder":
      return <Cylinder size={16} />;
    case "file-spreadsheet":
      return <FileSpreadsheet size={16} />;
    case "network":
      return <Network size={16} />;
    default:
      return <Database size={16} />;
  }
};

const CARD_COLORS = [
  "#0e639c",
  "#2e7d32",
  "#6a1b9a",
  "#c62828",
  "#ef6c00",
  "#00838f",
  "#4527a0",
  "#37474f",
];

/**
 * Hash chuỗi → số nguyên không âm. Dùng để chọn icon/màu ổn định
 * theo `manager.id`: cùng một manager luôn hiển thị cùng icon/màu
 * dù re-render, nhưng khác manager thì khác nhau (cảm giác random).
 */
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

const DatabaseManagerCard: React.FC<DatabaseManagerCardProps> = ({
  manager,
  onChanged,
}) => {
  const dbFetch = useDbFetch();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [busy, setBusy] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const seed = hashString(manager.id);
  const color = CARD_COLORS[seed % CARD_COLORS.length];
  const iconNode = renderIcon(ICON_KEYS[seed % ICON_KEYS.length]);

  const infoLine =
    manager.type === "local-file"
      ? `File · ${manager.file_path ?? "?"}`
      : `Connection · ${manager.host ?? "?"}${
          manager.port ? ":" + manager.port : ""
        }/${manager.database_name ?? "?"}`;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ top: e.clientY, left: e.clientX });
    setMenuOpen(true);
  };

  const openContainerFolder = () => {
    if (!manager.file_path) return;
    // Lấy thư mục chứa file rồi mở trong OS file manager
    const folder = manager.file_path.replace(/[/\\][^/\\]+$/, "") || manager.file_path;
    extensionService.postMessage({ command: "openPath", path: folder });
  };

  const createAndOpenContainerFolder = () => {
    if (!manager.file_path) return;
    // Tạo thư mục chứa file (nếu chưa tồn tại) rồi mở trong OS file manager
    const folder = manager.file_path.replace(/[/\\][^/\\]+$/, "") || manager.file_path;
    extensionService.postMessage({ command: "createFolderAndOpen", path: folder });
  };

  const testConnection = async () => {
    setBusy(true);
    setTestStatus(null);
    try {
      const res = await dbFetch(`/v1/database-managers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manager),
      });
      const data = await res.json();
      setTestStatus({
        ok: !!data.success,
        message: data.message ?? (data.success ? "OK" : "Failed"),
      });
    } catch (e: any) {
      setTestStatus({ ok: false, message: e?.message ?? "Network error" });
    } finally {
      setBusy(false);
    }
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

  if (editing) {
    return (
      <DatabaseManagerForm
        initial={manager as unknown as DatabaseManagerPayload}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        style={{
          borderRadius: "8px",
          padding: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "context-menu",
          backgroundColor: "var(--input-bg)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {iconNode}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
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
          <span
            style={{
              fontSize: "11px",
              color: "var(--secondary-text)",
              opacity: 0.8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {infoLine}
          </span>
          {testStatus && (
            <span
              style={{
                fontSize: "11px",
                marginTop: "2px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: testStatus.ok
                  ? "var(--vscode-testing-iconPassed, #4caf50)"
                  : "var(--vscode-errorForeground, #f87171)",
              }}
              title={testStatus.message}
            >
              {testStatus.ok ? (
                <CheckCircle2 size={11} style={{ flexShrink: 0 }} />
              ) : (
                <XCircle size={11} style={{ flexShrink: 0 }} />
              )}
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {testStatus.ok ? "OK — " : "Failed — "}
                {testStatus.message}
              </span>
            </span>
          )}
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
          {manager.type === "connection" && (
            <DropdownItem
              icon={<Zap size={14} />}
              onClick={testConnection}
            >
              Test connection
            </DropdownItem>
          )}
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
              Create &amp; Open Folder
            </DropdownItem>
          )}
          <DropdownItem icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
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
    </>
  );
};

export default DatabaseManagerCard;