/**
 * ------------------------------------------------------------------
 * GeneralSettings
 * ------------------------------------------------------------------
 * Tab General trong Settings Panel
 * Bao gồm: Backend API URL, AI Language, Commit Message Language
 * ------------------------------------------------------------------
 */

import React from "react";
import { FolderOpen, ExternalLink } from "lucide-react";
import { useSettings } from "../../../context/SettingsContext";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { LANGUAGES } from "../components/LanguageSelector";
import { extensionService } from "../../../services/ExtensionService";

/**
 * Hàng nhập path với 2 nút: Browse (mở dialog chọn) và Open (mở trong OS).
 * mode='pickFile' → chọn file; mode='pickFolder' → chọn folder.
 */
const PathPickerRow: React.FC<{
  label: string;
  description: string;
  value: string;
  onChange: (path: string) => void;
  mode: "pickFile" | "pickFolder";
  placeholder?: string;
}> = ({ label, description, value, onChange, mode, placeholder }) => {
  const requestIdRef = React.useRef(0);
  const [pending, setPending] = React.useState(false);

  const pick = () => {
    const requestId = `pickPath-${Date.now()}-${++requestIdRef.current}`;
    setPending(true);
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.requestId !== requestId || msg?.command !== "pathPicked") return;
      window.removeEventListener("message", handler);
      setPending(false);
      if (msg.cancelled) return;
      if (typeof msg.path === "string" && msg.path) onChange(msg.path);
    };
    window.addEventListener("message", handler);
    extensionService.postMessage({
      command: "pickPath",
      requestId,
      mode,
      defaultPath: value || undefined,
    });
  };

  const open = () => {
    if (!value) return;
    extensionService.postMessage({ command: "openPath", path: value });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--primary-text)",
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={pick}
          disabled={pending}
          title="Browse"
          aria-label="Browse"
          style={{
            ...inputStyle,
            width: "34px",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          <FolderOpen size={16} />
        </button>
        <button
          type="button"
          onClick={open}
          disabled={!value}
          title="Open"
          aria-label="Open"
          style={{
            ...inputStyle,
            width: "34px",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: value ? "pointer" : "not-allowed",
            opacity: value ? 1 : 0.5,
          }}
        >
          <ExternalLink size={16} />
        </button>
      </div>
      {description && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--secondary-text)",
            opacity: 0.7,
            marginTop: "2px",
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
};

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
        gap: "20px",
      }}
    >
      {/* Backend API URL */}
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
        <Dropdown align="start" side="bottom" sideOffset={4}>
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
        <Dropdown align="start" side="bottom" sideOffset={4}>
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

      {/* Chromium Profile Directory */}
      <PathPickerRow
        label="Chromium Profile Folder"
        description=""
        value={chromiumProfileDir}
        onChange={setChromiumProfileDir}
        mode="pickFolder"
        placeholder="/home/user/.elara/profiles"
      />
    </div>
  );
};

export default GeneralSettings;
