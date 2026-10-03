/**
 * ------------------------------------------------------------------
 * GeneralSettings
 * ------------------------------------------------------------------
 * Tab General trong Settings Panel. Được chia thành các GroupSection:
 * - Backend Connection : URL backend
 * - Chromium Profile   : Profile folder path + auto-detect subpath
 * - Language           : ngôn ngữ AI + ngôn ngữ commit message
 * Database Managers đã được tách sang tab riêng (xem Database.tsx).
 * ------------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import { Server, Languages, FolderOpen, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useSettings } from "../../../../context/SettingsContext";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../components/ui/Dropdown";
import { LANGUAGES } from "./LanguageSelector";
import GroupSection from "../database/GroupSection";

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

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; subpaths: string[] }
  | { status: "error"; message: string };

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
    chromiumProfileSubpath,
    setChromiumProfileSubpath,
  } = useSettings();

  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  // Debounce timer để tự động quét sau khi user dừng gõ path
  const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track path đã được quét để tránh quét lặp
  const lastScannedDirRef = useRef<string>("");

  /**
   * Quét folder profile và tự động chọn subpath nếu chỉ có 1 kết quả.
   * Nếu mảng subpaths rỗng → cấu trúc mặc định → tự động đặt subpath = "".
   */
  const scanProfileDir = async (dir: string) => {
    if (!dir || !apiUrl) {
      setScanState({ status: "idle" });
      return;
    }
    if (lastScannedDirRef.current === dir) return;

    setScanState({ status: "scanning" });
    try {
      const res = await fetch(`${apiUrl}/v1/config/scan-profile-dir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_dir: dir }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setScanState({
          status: "error",
          message: json.message || "Failed to scan folder",
        });
        return;
      }

      lastScannedDirRef.current = dir;
      const subpaths: string[] = json.data?.subpaths ?? [];
      setScanState({ status: "done", subpaths });

      // Tự động áp dụng: cấu trúc mặc định hoặc chỉ có 1 subpath duy nhất
      if (subpaths.length === 0) {
        setChromiumProfileSubpath("");
      } else if (subpaths.length === 1) {
        setChromiumProfileSubpath(subpaths[0]);
      }
      // Nếu có nhiều subpath → giữ nguyên để user chọn
    } catch {
      setScanState({
        status: "error",
        message: "Cannot connect to backend",
      });
    }
  };

  // Khi chromiumProfileDir thay đổi → debounce quét 800ms
  useEffect(() => {
    if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
    if (!chromiumProfileDir) {
      setScanState({ status: "idle" });
      lastScannedDirRef.current = "";
      return;
    }
    // Reset nếu path thay đổi
    if (lastScannedDirRef.current !== chromiumProfileDir) {
      setScanState({ status: "idle" });
    }
    scanDebounceRef.current = setTimeout(() => {
      scanProfileDir(chromiumProfileDir);
    }, 800);
    return () => {
      if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromiumProfileDir, apiUrl]);

  // Khi apiUrl thay đổi → reset để quét lại với URL mới
  useEffect(() => {
    lastScannedDirRef.current = "";
    if (chromiumProfileDir) {
      setScanState({ status: "idle" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const renderSubpathSelector = () => {
    if (!chromiumProfileDir) return null;

    if (scanState.status === "scanning") {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "var(--secondary-text)",
            marginTop: "4px",
          }}
        >
          <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
          Scanning folder structure...
        </div>
      );
    }

    if (scanState.status === "error") {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "var(--error-color, #e57373)",
            marginTop: "4px",
          }}
        >
          <AlertCircle size={12} />
          {scanState.message}
        </div>
      );
    }

    if (scanState.status === "done") {
      const { subpaths } = scanState;

      // Cấu trúc mặc định (rỗng) → hiển thị badge xác nhận, không cần chọn
      if (subpaths.length === 0) {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--success-color, #81c784)",
              marginTop: "4px",
            }}
          >
            <CheckCircle2 size={12} />
            Standard structure detected — no subpath needed
          </div>
        );
      }

      // 1 subpath → đã tự chọn, chỉ hiển thị xác nhận
      if (subpaths.length === 1) {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--success-color, #81c784)",
              marginTop: "4px",
            }}
          >
            <CheckCircle2 size={12} />
            Subpath auto-detected:{" "}
            <code
              style={{
                backgroundColor: "var(--input-bg)",
                padding: "0 4px",
                borderRadius: "4px",
                fontSize: "11px",
              }}
            >
              {subpaths[0]}
            </code>
          </div>
        );
      }

      // Nhiều subpath → hiển thị dropdown chọn
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
          <label
            style={{
              fontSize: "12px",
              color: "var(--secondary-text)",
            }}
          >
            Multiple structures found — select the correct subpath:
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
                <span style={{ fontSize: "13px", color: chromiumProfileSubpath ? "var(--primary-text)" : "var(--placeholder-text, var(--secondary-text))" }}>
                  {chromiumProfileSubpath || "Select subpath..."}
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
            <DropdownContent>
              {subpaths.map((sp) => (
                <DropdownItem
                  key={sp || "__default__"}
                  onClick={() => setChromiumProfileSubpath(sp)}
                >
                  {sp || (
                    <span style={{ color: "var(--secondary-text)", fontStyle: "italic" }}>
                      (default — no subpath)
                    </span>
                  )}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </div>
      );
    }

    return null;
  };

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
        description="Backend API address."
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
      </GroupSection>

      {/* Chromium Profile */}
      <GroupSection
        icon={<FolderOpen size={16} />}
        color="#2e7d32"
        title="Chromium Profile"
        description="Path to the folder containing browser profiles."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Profile Folder
          </label>
          <input
            type="text"
            value={chromiumProfileDir}
            onChange={(e) => {
              // Reset scan nếu path thay đổi
              lastScannedDirRef.current = "";
              setChromiumProfileDir(e.target.value);
            }}
            placeholder="/home/user/.elara/profiles"
            style={inputStyle}
          />
          {renderSubpathSelector()}
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
    </div>
  );
};

export default GeneralSettings;
