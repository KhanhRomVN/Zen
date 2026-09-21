/**
 * ------------------------------------------------------------------
 * GeneralSettings
 * ------------------------------------------------------------------
 * Tab General trong Settings Panel. Được chia thành các GroupSection:
 * - Backend Connection: URL backend + Chromium profile folder
 * - Language: ngôn ngữ AI + ngôn ngữ commit message
 * - Database Managers: cardUI quản lý các DB manager (local-file/connection)
 *   + selector database đang active cho workspace hiện tại
 * ------------------------------------------------------------------
 */

import React from "react";
import {
  Server,
  Languages,
  Database,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { useSettings } from "../../../context/SettingsContext";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { LANGUAGES } from "./LanguageSelector";
import GroupSection from "./GroupSection";
import DatabaseManagerCard, { DatabaseManagerRow } from "./DatabaseManagerCard";
import DatabaseManagerForm from "./DatabaseManagerForm";


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

/**
 * Section quản lý Database Managers: fetch list từ backend, hiển thị
 * card, cho phép thêm/sửa/xóa. Tự refresh khi có thay đổi.
 * Phía trên danh sách card có selector chọn database active cho workspace.
 */
const DatabaseManagersSection: React.FC = () => {
  const { apiUrl, activeDatabaseManagerId, setActiveDatabaseManagerId } =
    useSettings();
  const [managers, setManagers] = React.useState<DatabaseManagerRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
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
        }
      })
      .catch(() => {
        /* backend chưa sẵn sàng — giữ list cũ */
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  React.useEffect(() => {
    load();
  }, [load]);

  const activeManager = managers.find((m) => m.id === activeDatabaseManagerId);

  return (
    <GroupSection
      icon={<Database size={16} />}
      color="#2e7d32"
      title="Database Managers"
      description="Manage local or remote database connections."
      action={
        !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
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
        )
      }
    >
      {/* Active database selector */}
      {managers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--secondary-text)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Active Database (this workspace)
          </label>
          <Dropdown align="start" side="bottom" sideOffset={4}>
            <DropdownTrigger asChild>
              <button
                type="button"
                style={{
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <CheckCircle2
                    size={14}
                    style={{ color: "#2e7d32", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {activeManager?.name ?? "Select database…"}
                  </span>
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </DropdownTrigger>
            <DropdownContent>
              {managers.map((m) => {
                const routable = isRoutable(m);
                return (
                  <DropdownItem
                    key={m.id}
                    disabled={!routable}
                    icon={
                      m.id === activeDatabaseManagerId ? (
                        <CheckCircle2 size={14} style={{ color: "#2e7d32" }} />
                      ) : (
                        <Database size={14} />
                      )
                    }
                    onClick={() => {
                      if (routable) setActiveDatabaseManagerId(m.id);
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{m.name}</span>
                      {!routable && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--secondary-text)",
                            opacity: 0.8,
                            fontStyle: "italic",
                          }}
                        >
                          not routable yet
                        </span>
                      )}
                    </span>
                  </DropdownItem>
                );
              })}
            </DropdownContent>
          </Dropdown>
        </div>
      )}

      {/* Form create luôn nằm trên cùng danh sách card */}
      {creating && (
        <DatabaseManagerForm
          initial={null}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {managers.map((m) => (
        <DatabaseManagerCard key={m.id} manager={m} onChanged={load} />
      ))}

      {loading && (
        <span style={{ fontSize: "11px", color: "var(--secondary-text)" }}>
          Loading...
        </span>
      )}
    </GroupSection>
  );
};

const GeneralSettings: React.FC = () => {
  const {
    apiUrl,
    setApiUrl,
    aiLanguage,
    setAiLanguage,
    commitMessageLanguage,
    setCommitMessageLanguage,
    chromiumProfileDir,
    setChromiumProfileDir,
  } = useSettings();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "28px",
      }}
    >
      {/* Backend Connection */}
      <GroupSection
        icon={<Server size={16} />}
        color="#1565c0"
        title="Backend Connection"
        description="Backend API address and Chromium profile folder."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Backend API URL
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:8888"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Chromium Profile Folder
          </label>
          <input
            type="text"
            value={chromiumProfileDir}
            onChange={(e) => setChromiumProfileDir(e.target.value)}
            placeholder="/home/user/.elara/profiles"
            style={inputStyle}
          />
        </div>
      </GroupSection>

      {/* Language */}
      <GroupSection
        icon={<Languages size={16} />}
        color="#6a1b9a"
        title="Language"
        description="AI response language and commit message language."
      >
        {/* AI Language Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            AI Language
          </label>
          <Dropdown align="start" side="bottom" sideOffset={4} searchable>
            <DropdownTrigger asChild>
              <button
                type="button"
                style={{
                  ...inputStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span>
                    {LANGUAGES.find((l) => l.name === aiLanguage)?.flag || "🌐"}
                  </span>
                  <span>{aiLanguage}</span>
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </DropdownTrigger>
            <DropdownContent className="language-dropdown-content">
              {LANGUAGES.map((lang) => (
                <DropdownItem
                  key={lang.code}
                  icon={<span>{lang.flag}</span>}
                  onClick={() => setAiLanguage(lang.name)}
                >
                  {lang.name}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </div>

        {/* Commit Message Language Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Commit Message Language
          </label>
          <Dropdown align="start" side="bottom" sideOffset={4} searchable>
            <DropdownTrigger asChild>
              <button
                type="button"
                style={{
                  ...inputStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span>
                    {LANGUAGES.find((l) => l.code === commitMessageLanguage)
                      ?.flag || "🌐"}
                  </span>
                  <span>
                    {LANGUAGES.find((l) => l.code === commitMessageLanguage)
                      ?.name || commitMessageLanguage}
                  </span>
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </DropdownTrigger>
            <DropdownContent className="language-dropdown-content">
              {LANGUAGES.map((lang) => (
                <DropdownItem
                  key={lang.code}
                  icon={<span>{lang.flag}</span>}
                  onClick={() => setCommitMessageLanguage(lang.code)}
                >
                  {lang.name}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </div>
      </GroupSection>

      {/* Database Managers */}
      <DatabaseManagersSection />
    </div>
  );
};

export default GeneralSettings;
