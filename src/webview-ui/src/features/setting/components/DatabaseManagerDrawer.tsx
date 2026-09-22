/**
 * ------------------------------------------------------------------
 * DatabaseManagerDrawer
 * ------------------------------------------------------------------
 * Bottom-sheet drawer tạo/sửa database manager. Hỗ trợ 2 loại:
 * - local-file : chọn đường dẫn file SQLite trong máy
 * - connection : host/port/database/username/password/sslMode/...
 *
 * Điều kiện lưu: local-file phải trỏ tới file tồn tại; connection phải
 * test connection thành công trước.
 * Tham khảo UI của EditAccountDrawer.
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Server,
  X,
  XCircle,
} from "lucide-react";
import { extensionService } from "../../../services/ExtensionService";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { useDbFetch } from "../../../services/useDbFetch";

export type ManagerType = "local-file" | "connection";
export type DbType =
  | "sqlite"
  | "postgres"
  | "mysql"
  | "mariadb"
  | "mssql"
  | "mongodb";

/** Các db_type hợp lệ cho kết nối từ xa (loại sqlite vì đã có 'local-file'). */
const CONNECTION_DB_TYPES: DbType[] = [
  "postgres",
  "mysql",
  "mariadb",
  "mssql",
  "mongodb",
];

/** File logo trong images/database_icons theo db_type (khớp DatabaseManagerCard). */
const DB_ICON_FILES: Partial<Record<DbType, string>> = {
  postgres: "postgresql.svg",
  mysql: "mysql.svg",
  mariadb: "mariadb.svg",
  mongodb: "mongodb.svg",
};

/** Logo engine từ images/database_icons; engine chưa có logo (VD: mssql) → icon Server. */
const DbTypeIcon: React.FC<{ type: DbType; size?: number }> = ({
  type,
  size = 16,
}) => {
  const file = DB_ICON_FILES[type];
  if (!file) return <Server size={size} style={{ flexShrink: 0 }} />;
  const base = (window as any).__zenImagesUri || "/images";
  return (
    <img
      src={`${base}/database_icons/${file}`}
      alt={type}
      width={size}
      height={size}
      draggable={false}
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
};

export interface DatabaseManagerPayload {
  id?: string;
  name: string;
  type: ManagerType;
  db_type?: DbType;
  icon?: string;
  color?: string;
  file_path?: string;
  host?: string;
  port?: number | null;
  database_name?: string;
  username?: string;
  password?: string;
  ssl_mode?: string;
  channel_binding?: string;
}

interface DatabaseManagerDrawerProps {
  open: boolean;
  /** Dữ liệu khởi tạo khi sửa; null khi tạo mới */
  initial?: DatabaseManagerPayload | null;
  onOpenChange: (open: boolean) => void;
  /** Gọi sau khi lưu thành công (create/update) */
  onSaved: () => void;
}

const SSL_MODES = [
  "disable",
  "allow",
  "prefer",
  "require",
  "verify-ca",
  "verify-full",
];
const CHANNEL_BINDINGS = ["disable", "prefer", "require"];

const PRIMARY = "var(--vscode-button-background, #0e639c)";
const PRIMARY_SOFT = `color-mix(in srgb, ${PRIMARY} 14%, transparent)`;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: "13px",
  backgroundColor: "var(--input-bg)",
  border: "none",
  borderRadius: "8px",
  color: "var(--primary-text)",
  outline: "none",
  boxSizing: "border-box",
  height: "34px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--secondary-text)",
  marginBottom: "5px",
  display: "block",
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

/** Ô nhập password có nút bật/tắt hiển thị giá trị. */
const PasswordInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, paddingRight: "34px" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? "Hide password" : "Show password"}
        aria-label={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          top: "50%",
          right: "4px",
          transform: "translateY(-50%)",
          width: "26px",
          height: "26px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: "6px",
          background: "transparent",
          color:
            "var(--vscode-input-placeholderForeground, var(--secondary-text))",
          cursor: "pointer",
        }}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
};

const DrawerBody: React.FC<Omit<DatabaseManagerDrawerProps, "open">> = ({
  initial,
  onOpenChange,
  onSaved,
}) => {
  const dbFetch = useDbFetch();
  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ManagerType>(initial?.type ?? "local-file");
  const [dbType, setDbType] = useState<DbType>(
    initial?.db_type ?? (initial?.type === "connection" ? "postgres" : "sqlite"),
  );
  const [filePath, setFilePath] = useState(initial?.file_path ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState<string>(
    initial?.port != null ? String(initial.port) : "",
  );
  const [databaseName, setDatabaseName] = useState(
    initial?.database_name ?? "",
  );
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [sslMode, setSslMode] = useState(initial?.ssl_mode ?? "prefer");
  const [channelBinding, setChannelBinding] = useState(
    initial?.channel_binding ?? "prefer",
  );

  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fileExists, setFileExists] = useState(false);
  const [checkingFile, setCheckingFile] = useState(false);

  // Kiểm tra file local có tồn tại không (debounce 300ms) để gate nút Save.
  React.useEffect(() => {
    if (type !== "local-file") return undefined;
    const p = filePath.trim();
    if (!p) {
      setFileExists(false);
      return undefined;
    }
    setCheckingFile(true);
    const requestId = `checkPath-${Date.now()}-${Math.random()}`;
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.requestId !== requestId || msg?.command !== "pathExistsResult") {
        return;
      }
      window.removeEventListener("message", handler);
      setCheckingFile(false);
      setFileExists(!!msg.exists);
    };
    window.addEventListener("message", handler);
    const debounce = setTimeout(() => {
      extensionService.postMessage({
        command: "checkPathExists",
        requestId,
        path: p,
      });
    }, 300);
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      setCheckingFile(false);
    }, 5000);
    return () => {
      clearTimeout(debounce);
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
    };
  }, [type, filePath]);

  // local-file yêu cầu file tồn tại; connection yêu cầu test connection thành công.
  const canSave =
    !!name.trim() && (type === "local-file" ? fileExists : testOk);

  const buildPayload = (): DatabaseManagerPayload => ({
    id: initial?.id,
    name: name.trim(),
    type,
    db_type: type === "connection" ? dbType : "sqlite",
    file_path: type === "local-file" ? filePath.trim() : undefined,
    host: type === "connection" ? host.trim() : undefined,
    port:
      type === "connection" && port.trim() !== ""
        ? Number(port.trim())
        : undefined,
    database_name: type === "connection" ? databaseName.trim() : undefined,
    username: type === "connection" ? username.trim() : undefined,
    password: type === "connection" ? password : undefined,
    ssl_mode: type === "connection" ? sslMode : undefined,
    channel_binding: type === "connection" ? channelBinding : undefined,
  });

  const pickFile = () => {
    const requestId = `pickPath-${Date.now()}`;
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.requestId !== requestId || msg?.command !== "pathPicked") return;
      window.removeEventListener("message", handler);
      if (msg.cancelled) return;
      if (typeof msg.path === "string" && msg.path) {
        setFilePath(msg.path);
        setTestOk(false);
      }
    };
    window.addEventListener("message", handler);
    extensionService.postMessage({
      command: "pickPath",
      requestId,
      mode: "pickFile",
      defaultPath: filePath || undefined,
    });
  };

  const testConnection = async () => {
    const payload = buildPayload();
    setTesting(true);
    setTestMessage(null);
    try {
      const res = await dbFetch(`/v1/database-managers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTestOk(!!data.success);
      setTestMessage(data.message ?? (data.success ? "OK" : "Failed"));
    } catch (e: any) {
      setTestOk(false);
      setTestMessage(e?.message ?? "Network error");
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      const path = isEdit
        ? `/v1/database-managers/${initial!.id}`
        : `/v1/database-managers`;
      const res = await dbFetch(path, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(data.message ?? "Save failed");
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = !canSave || saving || checkingFile;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          zIndex: 200,
          animation: "dmFadeIn 0.15s ease",
        }}
        onClick={() => !saving && onOpenChange(false)}
      />

      {/* Bottom Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "var(--tertiary-bg)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
          zIndex: 201,
          maxHeight: "80%",
          display: "flex",
          flexDirection: "column",
          animation: "dmSlideUp 0.22s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--primary-text)",
              }}
            >
              {isEdit ? "Edit Database Manager" : "Add Database Manager"}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--secondary-text)",
                opacity: 0.7,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {isEdit
                ? initial?.name
                : "Local SQLite file or remote connection"}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            style={{
              padding: "6px",
              borderRadius: "4px",
              border: "none",
              background: "transparent",
              color: "var(--secondary-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(244,67,54,0.15)";
              e.currentTarget.style.color = "#f44336";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--secondary-text)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My local database"
              disabled={saving}
              style={inputStyle}
            />
          </Field>

          <Field label="Storage type">
            <div style={{ display: "flex", gap: "8px" }}>
              {(["local-file", "connection"] as ManagerType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setTestOk(false);
                    setTestMessage(null);
                    // Chuyển sang connection mà đang giữ giá trị mặc định sqlite
                    // (vốn dành cho local-file) → đổi sang postgres.
                    if (t === "connection" && dbType === "sqlite") {
                      setDbType("postgres");
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    border: "none",
                    borderRadius: "8px",
                    backgroundColor:
                      type === t ? PRIMARY_SOFT : "var(--input-bg)",
                    color: type === t ? PRIMARY : "var(--primary-text)",
                    fontWeight: type === t ? 600 : 400,
                  }}
                >
                  {t === "local-file" ? "Local file" : "Connection"}
                </button>
              ))}
            </div>
          </Field>

          {type === "connection" && (
            <Field label="Database type">
              <Dropdown align="start" side="bottom" sideOffset={4}>
                <DropdownTrigger asChild>
                  <button
                    type="button"
                    style={{
                      ...inputStyle,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <DbTypeIcon type={dbType} />
                    {dbType}
                  </button>
                </DropdownTrigger>
                <DropdownContent>
                  {CONNECTION_DB_TYPES.map((t) => (
                    <DropdownItem
                      key={t}
                      icon={<DbTypeIcon type={t} />}
                      onClick={() => {
                        setDbType(t);
                        setTestOk(false);
                      }}
                    >
                      {t}
                    </DropdownItem>
                  ))}
                </DropdownContent>
              </Dropdown>
            </Field>
          )}

          {type === "local-file" ? (
            <Field label="Database file path">
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => {
                    setFilePath(e.target.value);
                    setTestOk(false);
                  }}
                  placeholder="~/.elara/database.sqlite"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={pickFile}
                  title="Browse"
                  style={{
                    ...inputStyle,
                    width: "34px",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    color:
                      "var(--vscode-input-placeholderForeground, var(--secondary-text))",
                  }}
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </Field>
          ) : (
            <>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <Field label="Host">
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => {
                        setHost(e.target.value);
                        setTestOk(false);
                      }}
                      placeholder="localhost"
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Field label="Port">
                    <input
                      type="text"
                      value={port}
                      onChange={(e) => {
                        setPort(e.target.value);
                        setTestOk(false);
                      }}
                      placeholder="5432"
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>

              <Field label="Database">
                <input
                  type="text"
                  value={databaseName}
                  onChange={(e) => {
                    setDatabaseName(e.target.value);
                    setTestOk(false);
                  }}
                  placeholder="mydb"
                  style={inputStyle}
                />
              </Field>

              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Field label="Username">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setTestOk(false);
                      }}
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Field label="Password">
                    <PasswordInput
                      value={password}
                      onChange={(v) => {
                        setPassword(v);
                        setTestOk(false);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Field label="SSL Mode">
                    <Dropdown align="start" side="bottom" sideOffset={4}>
                      <DropdownTrigger asChild>
                        <button
                          type="button"
                          style={{
                            ...inputStyle,
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          {sslMode}
                        </button>
                      </DropdownTrigger>
                      <DropdownContent>
                        {SSL_MODES.map((m) => (
                          <DropdownItem
                            key={m}
                            onClick={() => {
                              setSslMode(m);
                              setTestOk(false);
                            }}
                          >
                            {m}
                          </DropdownItem>
                        ))}
                      </DropdownContent>
                    </Dropdown>
                  </Field>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Field label="Channel Binding">
                    <Dropdown align="start" side="bottom" sideOffset={4}>
                      <DropdownTrigger asChild>
                        <button
                          type="button"
                          style={{
                            ...inputStyle,
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          {channelBinding}
                        </button>
                      </DropdownTrigger>
                      <DropdownContent>
                        {CHANNEL_BINDINGS.map((m) => (
                          <DropdownItem
                            key={m}
                            onClick={() => {
                              setChannelBinding(m);
                              setTestOk(false);
                            }}
                          >
                            {m}
                          </DropdownItem>
                        ))}
                      </DropdownContent>
                    </Dropdown>
                  </Field>
                </div>
              </div>

              {/* Test + result (chỉ áp dụng cho loại connection) */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {testing && !testMessage && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(128,128,128,0.10)",
                      color: "var(--secondary-text)",
                      fontSize: "12px",
                    }}
                  >
                    <Loader2
                      size={14}
                      style={{ animation: "dmSpin 1s linear infinite" }}
                    />
                    Testing connection… (this can take a few seconds)
                  </div>
                )}

                {!testing && testMessage && (
                  <div
                    role="status"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      backgroundColor: testOk
                        ? "rgba(76,175,80,0.14)"
                        : "rgba(248,113,113,0.14)",
                      color: testOk ? "#4caf50" : "#f87171",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {testOk ? (
                      <CheckCircle2
                        size={14}
                        style={{ flexShrink: 0, marginTop: "1px" }}
                      />
                    ) : (
                      <XCircle
                        size={14}
                        style={{ flexShrink: 0, marginTop: "1px" }}
                      />
                    )}
                    <span style={{ minWidth: 0 }}>
                      {testOk
                        ? "Connection succeeded — "
                        : "Connection failed — "}
                      {testMessage}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div
              style={{
                backgroundColor:
                  "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.08))",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "12px",
                color: "var(--vscode-errorForeground)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <AlertCircle size={12} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {type === "connection" && (
            <button
              type="button"
              className="dm-link-btn"
              onClick={testConnection}
              disabled={testing || saving}
              style={{
                marginRight: "auto",
                padding: "8px 4px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                background: "transparent",
                color: "var(--primary-text)",
                cursor: testing ? "wait" : saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              {testing && (
                <Loader2
                  size={12}
                  style={{ animation: "dmSpin 1s linear infinite" }}
                />
              )}
              {testing ? "Testing…" : "Test connection"}
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            style={{
              padding: "8px 14px",
              borderRadius: "9px",
              backgroundColor: "rgba(128,128,128,0.08)",
              border: "none",
              color: "var(--secondary-text)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saveDisabled}
            title={
              !canSave
                ? type === "local-file"
                  ? "Database file must exist"
                  : "Test connection must succeed first"
                : undefined
            }
            style={{
              padding: "8px 14px",
              borderRadius: "9px",
              backgroundColor: "rgba(34,197,94,0.12)",
              border: "none",
              color: "var(--vscode-testing-iconPassed, #22c55e)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: saveDisabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: !canSave || checkingFile ? 0.5 : saving ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {saving && (
              <Loader2
                size={13}
                style={{ animation: "dmSpin 1s linear infinite" }}
              />
            )}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dmSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes dmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .dm-link-btn:hover:not(:disabled) { text-decoration: underline; }
      `}</style>
    </>
  );
};

/**
 * Drawer tạo/sửa database manager. Body được mount mới mỗi lần mở
 * nên state form luôn khởi tạo lại từ `initial`.
 */
const DatabaseManagerDrawer: React.FC<DatabaseManagerDrawerProps> = ({
  open,
  initial,
  onOpenChange,
  onSaved,
}) => {
  if (!open) return null;
  return (
    <DrawerBody
      initial={initial}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  );
};

export default DatabaseManagerDrawer;