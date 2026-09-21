/**
 * ------------------------------------------------------------------
 * DatabaseManagerForm
 * ------------------------------------------------------------------
 * FormUI tạo/sửa database manager. Hỗ trợ 2 loại:
 * - local-file : chọn đường dẫn file SQLite trong máy
 * - connection : host/port/database/username/password/sslMode/...
 *
 * Yêu cầu test connection thành công trước khi cho phép lưu.
 * Style: border-dashed, không bo góc, không background.
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import { CheckCircle2, FolderOpen, Loader2, XCircle } from "lucide-react";
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

interface DatabaseManagerFormProps {
  /** Dữ liệu khởi tạo khi sửa; bỏ trống khi tạo mới */
  initial?: DatabaseManagerPayload | null;
  onCancel: () => void;
  onSaved: () => void;
}

const SSL_MODES = ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"];
const CHANNEL_BINDINGS = ["disable", "prefer", "require"];

// Input trong form dùng nền giống searchbar (var(--input-bg)), bỏ border,
// bo góc giống các UI bên ngoài form.
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

/** Nút hành động soft-style: nền nhạt + chữ đậm theo màu theme. */
const softButtonStyle = (fg: string, bg: string): React.CSSProperties => ({
  padding: "6px 14px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  borderRadius: "8px",
  backgroundColor: bg,
  color: fg,
});

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--secondary-text)",
  marginBottom: "4px",
  display: "block",
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

const DatabaseManagerForm: React.FC<DatabaseManagerFormProps> = ({
  initial,
  onCancel,
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
  const [databaseName, setDatabaseName] = useState(initial?.database_name ?? "");
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
  const [fileExists, setFileExists] = useState(false);
  const [checkingFile, setCheckingFile] = useState(false);

  // Kiểm tra file local có tồn tại không (debounce 300ms) để gate nút Create.
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
      } else {
        setTestMessage(data.message ?? "Save failed");
      }
    } catch (e: any) {
      setTestMessage(e?.message ?? "Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        border: "1px dashed var(--border-color)",
        borderRadius: 0,
        backgroundColor: "transparent",
        padding: "14px",
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
                  type === t
                    ? "rgba(14,99,156,0.14)"
                    : "var(--input-bg)",
                color:
                  type === t
                    ? "var(--vscode-button-background, #0e639c)"
                    : "var(--primary-text)",
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
                style={{ ...inputStyle, textAlign: "left", cursor: "pointer" }}
              >
                {dbType}
              </button>
            </DropdownTrigger>
            <DropdownContent>
              {CONNECTION_DB_TYPES.map((t) => (
                <DropdownItem
                  key={t}
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
            <div style={{ flex: 2 }}>
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
            <div style={{ flex: 1 }}>
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
            <div style={{ flex: 1 }}>
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
            <div style={{ flex: 1 }}>
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setTestOk(false);
                  }}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <Field label="SSL Mode">
                <Dropdown align="start" side="bottom" sideOffset={4}>
                  <DropdownTrigger asChild>
                    <button type="button" style={{ ...inputStyle, textAlign: "left", cursor: "pointer" }}>
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
            <div style={{ flex: 1 }}>
              <Field label="Channel Binding">
                <Dropdown align="start" side="bottom" sideOffset={4}>
                  <DropdownTrigger asChild>
                    <button type="button" style={{ ...inputStyle, textAlign: "left", cursor: "pointer" }}>
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
        </>
      )}

      {/* Test + result (chỉ áp dụng cho loại connection) */}
      {type === "connection" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div>
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              style={{
                ...softButtonStyle("var(--primary-text)", "var(--input-bg)"),
                cursor: testing ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {testing && <Loader2 size={12} className="spin" />}
              {testing ? "Testing…" : "Test connection"}
            </button>
          </div>

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
              <Loader2 size={14} className="spin" />
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
                <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
              ) : (
                <XCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
              )}
              <span style={{ minWidth: 0 }}>
                {testOk ? "Connection succeeded — " : "Connection failed — "}
                {testMessage}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            ...softButtonStyle(
              "var(--secondary-text)",
              "rgba(128,128,128,0.08)",
            ),
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving || checkingFile}
          style={{
            ...softButtonStyle(
              "var(--vscode-button-background, #0e639c)",
              "rgba(14,99,156,0.14)",
            ),
            cursor: !canSave || saving ? "not-allowed" : "pointer",
            opacity: !canSave || saving || checkingFile ? 0.5 : 1,
          }}
          title={
            !canSave
              ? type === "local-file"
                ? "Database file must exist"
                : "Test connection must succeed first"
              : undefined
          }
        >
          {saving ? "Saving..." : isEdit ? "Update" : "Create"}
        </button>
      </div>
    </div>
  );
};

export default DatabaseManagerForm;