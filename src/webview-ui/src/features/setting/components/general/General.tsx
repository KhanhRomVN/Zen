/**
 * ------------------------------------------------------------------
 * GeneralSettings
 * ------------------------------------------------------------------
 * Tab General: Backend Connection, Chromium Profile (tự quét subpath),
 * Language (ngôn ngữ AI + ngôn ngữ commit message).
 * ------------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Server,
  Languages,
  FolderOpen,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import { useSettings } from "../../../../context/SettingsContext";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../components/ui/Dropdown";
import { LANGUAGES } from "./LanguageSelector";
import { getChromeProfileDirs } from "../../../../services/chromeProfiles";
import type { ChromeProfileDir } from "../../../../services/chromeProfiles";
import {
  SectionCard,
  Field,
  Callout,
  StatusChip,
  Chevron,
} from "../shared/ui";

const BLUE = "#4c9dfb";
const GREEN = "#34d399";
const VIOLET = "#c084fc";
const RED = "#f87171";

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; subpaths: string[] }
  | { status: "error"; message: string };

interface LanguageDropdownProps {
  flag: string;
  label: string;
  onSelect: (code: string, name: string) => void;
}

const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  flag,
  label,
  onSelect,
}) => (
  <Dropdown
    align="start"
    side="bottom"
    sideOffset={6}
    searchable
    className="zs-dd"
    minWidth="trigger"
  >
    <DropdownTrigger asChild>
      <button type="button" className="zs-input zs-select">
        <span className="zs-select-value">
          <span>{flag}</span>
          <span>{label}</span>
        </span>
        <Chevron />
      </button>
    </DropdownTrigger>
    <DropdownContent className="zs-dd-content language-dropdown-content">
      {LANGUAGES.map((lang) => (
        <DropdownItem
          key={lang.code}
          icon={<span>{lang.flag}</span>}
          onClick={() => onSelect(lang.code, lang.name)}
        >
          {lang.name}
        </DropdownItem>
      ))}
    </DropdownContent>
  </Dropdown>
);

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
  const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScannedDirRef = useRef<string>("");
  const [chromeDirs, setChromeDirs] = useState<ChromeProfileDir[]>([]);

  const isPreset = chromeDirs.some((d) => d.path === chromiumProfileDir);

  useEffect(() => {
    getChromeProfileDirs()
      .then(setChromeDirs)
      .catch(() => setChromeDirs([]));
  }, []);

  const scanProfileDir = async (dir: string) => {
    if (!dir || !apiUrl || isPreset) {
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

      if (subpaths.length === 0) {
        setChromiumProfileSubpath("");
      } else if (subpaths.length === 1) {
        setChromiumProfileSubpath(subpaths[0]);
      }
    } catch {
      setScanState({ status: "error", message: "Cannot connect to backend" });
    }
  };

  useEffect(() => {
    if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
    if (!chromiumProfileDir) {
      setScanState({ status: "idle" });
      lastScannedDirRef.current = "";
      return;
    }
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

  useEffect(() => {
    lastScannedDirRef.current = "";
    if (chromiumProfileDir) {
      setScanState({ status: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const renderScanResult = () => {
    if (!chromiumProfileDir) return null;

    if (scanState.status === "scanning") {
      return (
        <StatusChip
          color={BLUE}
          icon={<Loader2 size={12} className="zs-spin" />}
        >
          Scanning folder structure...
        </StatusChip>
      );
    }

    if (scanState.status === "error") {
      return (
        <StatusChip color={RED} icon={<AlertCircle size={12} />}>
          {scanState.message}
        </StatusChip>
      );
    }

    if (scanState.status !== "done") return null;

    const { subpaths } = scanState;

    if (subpaths.length === 0) {
      return (
        <StatusChip color={GREEN} icon={<CheckCircle2 size={12} />}>
          Standard structure detected — no subpath needed
        </StatusChip>
      );
    }

    if (subpaths.length === 1) {
      return (
        <StatusChip color={GREEN} icon={<CheckCircle2 size={12} />}>
          Subpath auto-detected: <code>{subpaths[0]}</code>
        </StatusChip>
      );
    }

    return (
      <Field
        label="Subpath"
        hint="Multiple structures found — select the correct subpath."
      >
        <Dropdown
          align="start"
          side="bottom"
          sideOffset={6}
          className="zs-dd"
          minWidth="trigger"
        >
          <DropdownTrigger asChild>
            <button type="button" className="zs-input zs-select zs-mono">
              <span
                style={{
                  color: chromiumProfileSubpath
                    ? "var(--primary-text)"
                    : "var(--secondary-text)",
                }}
              >
                {chromiumProfileSubpath || "Select subpath..."}
              </span>
              <Chevron />
            </button>
          </DropdownTrigger>
          <DropdownContent className="zs-dd-content">
            {subpaths.map((sp) => (
              <DropdownItem
                key={sp || "__default__"}
                onClick={() => setChromiumProfileSubpath(sp)}
              >
                {sp || (
                  <span
                    style={{
                      color: "var(--secondary-text)",
                      fontStyle: "italic",
                    }}
                  >
                    (default — no subpath)
                  </span>
                )}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      </Field>
    );
  };

  const commitLang = LANGUAGES.find((l) => l.code === commitMessageLanguage);
  const aiLang = LANGUAGES.find((l) => l.name === aiLanguage);

  return (
    <div className="zs-stack">
      <SectionCard
        icon={<Server size={17} />}
        accent={BLUE}
        title="Backend Connection"
        description="Backend API address."
      >
        <Field label="Backend API URL">
          <input
            type="text"
            className="zs-input zs-mono"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:8888"
            spellCheck={false}
          />
        </Field>
      </SectionCard>

      <SectionCard
        icon={<FolderOpen size={17} />}
        accent={GREEN}
        title="Chromium Profile"
        description="Path to the folder containing browser profiles."
      >
        <Callout
          accent={GREEN}
          icon={<Info size={18} />}
          title="Use Chrome profiles"
          badge="Recommended"
        >
          Using Chrome lets you log in and add accounts quickly. Zen reuses your
          existing Chrome profiles, so adding a new account takes just a few
          clicks.
        </Callout>
        <Field label="Profile Folder">
          <input
            type="text"
            className="zs-input zs-mono"
            value={chromiumProfileDir}
            onChange={(e) => {
              lastScannedDirRef.current = "";
              setChromiumProfileDir(e.target.value);
            }}
            placeholder={
              chromeDirs[0]?.path
                ? `Mặc định: ${chromeDirs[0].path}`
                : "/home/user/.elara/profiles"
            }
            spellCheck={false}
          />
        </Field>
        {renderScanResult()}
      </SectionCard>

      <SectionCard
        icon={<Languages size={17} />}
        accent={VIOLET}
        title="Language"
        description="AI response language and commit message language."
      >
        <div className="zs-grid2">
          <Field label="AI Language">
            <LanguageDropdown
              flag={aiLang?.flag || "🌐"}
              label={aiLanguage}
              onSelect={(_code, name) => setAiLanguage(name)}
            />
          </Field>
          <Field label="Commit Message Language">
            <LanguageDropdown
              flag={commitLang?.flag || "🌐"}
              label={commitLang?.name || commitMessageLanguage}
              onSelect={(code) => setCommitMessageLanguage(code)}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
};

export default GeneralSettings;