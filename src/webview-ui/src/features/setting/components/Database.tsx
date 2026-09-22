/**
 * ------------------------------------------------------------------
 * DatabaseSettings
 * ------------------------------------------------------------------
 * Tab Database trong Settings Panel: danh sách card DB manager
 * (local-file/connection), click card để chọn database active cho
 * workspace hiện tại. Thêm/sửa thông qua DatabaseManagerDrawer.
 * Tab này độc lập hoàn toàn với tab General.
 * ------------------------------------------------------------------
 */

import React from "react";
import { Database, Plus, Plug, Loader2 } from "lucide-react";
import { useSettings } from "../../../context/SettingsContext";
import { extensionService } from "../../../services/ExtensionService";
import { useDbFetch } from "../../../services/useDbFetch";
import GroupSection from "./GroupSection";
import DatabaseManagerCard, {
  DatabaseManagerRow,
  DbStatus,
} from "./DatabaseManagerCard";
import DatabaseManagerDrawer, {
  DatabaseManagerPayload,
} from "./DatabaseManagerDrawer";

/**
 * Manager có được backend route thực sự hay không.
 * - local-file + sqlite: mở file SQLite riêng.
 * - connection + postgres: Kysely + pg Pool.
 * Các engine khác (mysql/mariadb/mssql/mongodb) chưa hỗ trợ routing.
 *
 * Phải khớp với logic resolve trong
 * `AIWeb2API/src/middleware/database-context.middleware.ts`.
 */
const isRoutable = (m: DatabaseManagerRow): boolean =>
  m.type === "local-file" ||
  (m.type === "connection" && m.db_type === "postgres");

/** Kiểm tra file local có tồn tại qua extension host (timeout 5s → coi như không tồn tại). */
const checkLocalFile = (path: string): Promise<boolean> =>
  new Promise((resolve) => {
    const requestId = `checkPath-${Date.now()}-${Math.random()}`;
    const cleanup = () => {
      window.removeEventListener("message", handler);
      clearTimeout(timer);
    };
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.requestId !== requestId || msg?.command !== "pathExistsResult") {
        return;
      }
      cleanup();
      resolve(!!msg.exists);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, 5000);
    window.addEventListener("message", handler);
    extensionService.postMessage({
      command: "checkPathExists",
      requestId,
      path,
    });
  });

/**
 * Kiểm tra trạng thái một manager: local-file → file có tồn tại;
 * connection → gọi endpoint test connection của backend.
 */
const runCheck = async (
  m: DatabaseManagerRow,
  dbFetch: ReturnType<typeof useDbFetch>,
): Promise<DbStatus> => {
  if (m.type === "local-file") {
    if (!m.file_path) return { state: "error", message: "No file path set" };
    const exists = await checkLocalFile(m.file_path);
    return exists
      ? { state: "ok" }
      : { state: "error", message: "Database file not found" };
  }
  try {
    const res = await dbFetch(`/v1/database-managers/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    });
    const data = await res.json();
    return data.success
      ? { state: "ok", message: data.message }
      : { state: "error", message: data.message ?? "Connection failed" };
  } catch (e: any) {
    return { state: "error", message: e?.message ?? "Network error" };
  }
};

/**
 * Tab Database Managers: fetch list từ backend, hiển thị card, cho phép
 * chọn active/thêm/sửa/xóa. Tự kiểm tra trạng thái tất cả connection khi
 * mở tab và khi bấm "Check all".
 */
const DatabaseSettings: React.FC = () => {
  const { apiUrl, activeDatabaseManagerId, setActiveDatabaseManagerId } =
    useSettings();
  const dbFetch = useDbFetch();
  const dbFetchRef = React.useRef(dbFetch);
  dbFetchRef.current = dbFetch;

  const [managers, setManagers] = React.useState<DatabaseManagerRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [statuses, setStatuses] = React.useState<Record<string, DbStatus>>({});
  const [drawer, setDrawer] = React.useState<{
    open: boolean;
    initial: DatabaseManagerPayload | null;
  }>({ open: false, initial: null });

  const checkOne = React.useCallback(async (m: DatabaseManagerRow) => {
    setStatuses((prev) => ({ ...prev, [m.id]: { state: "checking" } }));
    const result = await runCheck(m, dbFetchRef.current);
    setStatuses((prev) => ({ ...prev, [m.id]: result }));
  }, []);

  const load = React.useCallback(
    (testAfter: boolean) => {
      if (!apiUrl) return;
      setLoading(true);
      const headers: Record<string, string> = {};
      if (activeDatabaseManagerId)
        headers["x-database-manager-id"] = activeDatabaseManagerId;
      fetch(`${apiUrl}/v1/database-managers`, { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const rows: DatabaseManagerRow[] = res.data;
            setManagers(rows);
            setLoaded(true);
            // Chỉ manager được backend route thực sự (xem middleware
            // database-context để biết engine nào hỗ trợ).
            const routableRows = rows.filter(isRoutable);
            // Auto-select database đầu tiên nếu chưa có lựa chọn hoặc ID hiện tại
            // không còn routable (VD: đang trỏ tới connection type đã bị chặn).
            if (routableRows.length > 0) {
              const stillRoutable = routableRows.some(
                (m) => m.id === activeDatabaseManagerId,
              );
              if (!activeDatabaseManagerId || !stillRoutable) {
                setActiveDatabaseManagerId(routableRows[0].id);
              }
            }
            if (testAfter) rows.forEach((row) => void checkOne(row));
          }
        })
        .catch(() => {
          /* backend chưa sẵn sàng — giữ list cũ */
        })
        .finally(() => setLoading(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [apiUrl],
  );

  React.useEffect(() => {
    load(true);
  }, [load]);

  const checkAll = () => managers.forEach((m) => void checkOne(m));
  const anyChecking = managers.some(
    (m) => statuses[m.id]?.state === "checking",
  );
  const activeCount = managers.some((m) => m.id === activeDatabaseManagerId)
    ? 1
    : 0;
  const openCreate = () => setDrawer({ open: true, initial: null });

  return (
    <>
      <GroupSection
        icon={<Database size={16} />}
        color="#2e7d32"
        title="Database Managers"
        description="Select a connection for Zen to read schema and run queries in this workspace."
        action={
          <button
            type="button"
            onClick={openCreate}
            title="Add database manager"
            aria-label="Add database manager"
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: "none",
              borderRadius: "8px",
              backgroundColor: "rgba(46,125,50,0.15)",
              color: "#2e7d32",
            }}
          >
            <Plus size={16} />
          </button>
        }
      >
        {/* Toolbar: đếm + kiểm tra tất cả */}
        {managers.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11.5px",
                color: "var(--secondary-text)",
                opacity: 0.8,
              }}
            >
              {managers.length}{" "}
              {managers.length === 1 ? "connection" : "connections"} ·{" "}
              {activeCount} active
            </span>
            <button
              type="button"
              onClick={checkAll}
              disabled={anyChecking}
              style={{
                height: "26px",
                padding: "0 9px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11.5px",
                fontWeight: 500,
                border: "none",
                borderRadius: "8px",
                backgroundColor: "var(--input-bg)",
                color: "var(--primary-text)",
                cursor: anyChecking ? "wait" : "pointer",
                opacity: anyChecking ? 0.7 : 1,
              }}
            >
              {anyChecking ? (
                <Loader2
                  size={12}
                  style={{ animation: "dbSpin 1s linear infinite" }}
                />
              ) : (
                <Plug size={12} />
              )}
              Check all
            </button>
          </div>
        )}

        {/* Danh sách card */}
        {managers.length > 0 && (
          <div
            role="radiogroup"
            aria-label="Active database"
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
          >
            {managers.map((m) => (
              <DatabaseManagerCard
                key={m.id}
                manager={m}
                active={m.id === activeDatabaseManagerId}
                routable={isRoutable(m)}
                status={statuses[m.id] ?? { state: "idle" }}
                onSelect={(row) => setActiveDatabaseManagerId(row.id)}
                onEdit={(row) =>
                  setDrawer({
                    open: true,
                    initial: row as unknown as DatabaseManagerPayload,
                  })
                }
                onTest={(row) => void checkOne(row)}
                onChanged={() => load(false)}
              />
            ))}
          </div>
        )}

        {/* Empty state: chỉ hiện khi đã load xong và không có card nào */}
        {loaded && managers.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              padding: "22px 16px",
              textAlign: "center",
              border: "1px dashed var(--border-color)",
              borderRadius: "12px",
              color: "var(--secondary-text)",
            }}
          >
            <Database size={20} style={{ opacity: 0.6 }} />
            <span
              style={{
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--primary-text)",
              }}
            >
              No connections yet
            </span>
            <span
              style={{
                fontSize: "11.5px",
                maxWidth: "30ch",
                lineHeight: 1.45,
              }}
            >
              Add a local SQLite file or a remote connection so Zen can read
              your schema.
            </span>
            <button
              type="button"
              onClick={openCreate}
              style={{
                height: "26px",
                padding: "0 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11.5px",
                fontWeight: 600,
                border: "none",
                borderRadius: "8px",
                backgroundColor: "var(--vscode-button-background, #0e639c)",
                color: "var(--vscode-button-foreground, #ffffff)",
                cursor: "pointer",
              }}
            >
              <Plus size={12} />
              Add connection
            </button>
          </div>
        )}

        {loading && !loaded && (
          <span style={{ fontSize: "11px", color: "var(--secondary-text)" }}>
            Loading...
          </span>
        )}

        <style>{`
          @keyframes dbSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </GroupSection>

      <DatabaseManagerDrawer
        open={drawer.open}
        initial={drawer.initial}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
        onSaved={() => load(true)}
      />
    </>
  );
};

export default DatabaseSettings;
