import React, { createContext, useContext, useState, useEffect } from "react";
import { extensionService } from "../services/ExtensionService";
import type { LanguageCode } from "../i18n";

export type PermissionMode = "fullAccess" | "approval" | "readOnly";

interface SettingsContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  aiLanguage: string;
  setAiLanguage: (lang: string) => void;
  commitMessageLanguage: "en" | "vi";
  setCommitMessageLanguage: (lang: "en" | "vi") => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  toolPermissions: Record<string, "full_access" | "review">;
  setToolPermission: (toolId: string, value: "full_access" | "review") => void;
  setAllToolPermissions: (value: "full_access" | "review") => void;
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
  isSimpleMode: boolean;
  setIsSimpleMode: (value: boolean) => void;
  liveWritePreview: boolean;
  setLiveWritePreview: (value: boolean) => void;
}

export const defaultToolPermissions: Record<string, "full_access" | "review"> =
  {
    read_file: "full_access",
    write_to_file: "full_access",
    replace_in_file: "full_access",
    list_files: "full_access",
    search_files: "full_access",
    run_command: "full_access",
    move_file: "full_access",
  };

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem("zen_preferred_language");
      if (saved === "vi" || saved === "en") return saved;
    } catch (e) {}
    return "en";
  });
  const [aiLanguage, setAiLanguageState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("zen_ai_language");
      if (saved) return saved;
    } catch (e) {}
    return "English";
  });
  const [commitMessageLanguage, setCommitMessageLanguageState] = useState<
    "en" | "vi"
  >(() => {
    try {
      const saved = localStorage.getItem("zen_commit_message_language");
      if (saved === "vi" || saved === "en") return saved;
    } catch (e) {}
    // Default: use UI language as fallback
    try {
      const uiLang = localStorage.getItem("zen_preferred_language");
      if (uiLang === "vi") return "vi";
    } catch (e) {}
    return "en";
  });
  const [apiUrl, setApiUrlState] = useState("http://localhost:8888");
  const [permissionModeState, setPermissionModeState] =
    useState<PermissionMode>("fullAccess");
  const [toolPermissionsState, setToolPermissionsState] = useState<
    Record<string, "full_access" | "review">
  >(defaultToolPermissions);
  const [isSimpleMode, setIsSimpleModeState] = useState<boolean>(true);
  const [liveWritePreview, setLiveWritePreviewState] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("zen-simple-mode");
      if (saved !== null) {
        setIsSimpleModeState(saved !== "false");
      }
    } catch (e) {}
    const storage = extensionService.getStorage();

    storage.get("backend-api-url").then((res: any) => {
      if (res?.value) {
        setApiUrlState(res.value);
      }
    });

    storage.get("zen_permission_mode").then((res: any) => {
      if (res?.value) {
        const val = res.value;
        // Migrate old 4-mode values to new 3-mode system
        const migrationMap: Record<string, PermissionMode> = {
          bypassPermissions: "fullAccess",
          acceptEdits: "approval",
          auto: "approval",
          plan: "readOnly",
          fullAccess: "fullAccess",
          approval: "approval",
          readOnly: "readOnly",
        };
        setPermissionModeState(migrationMap[val] ?? "fullAccess");
      }
    });

    storage.get("zen_tool_permissions").then((res: any) => {
      if (res?.value) {
        try {
          const parsed = JSON.parse(res.value);
          setToolPermissionsState({ ...defaultToolPermissions, ...parsed });
        } catch (e) {
          // Fallback to default if parsing fails
        }
      }
    });
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang === "vi" ? "vi" : "en");
    try {
      localStorage.setItem("zen_preferred_language", lang);
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_preferred_language", lang);
  };

  const setAiLanguage = (lang: string) => {
    setAiLanguageState(lang);
    try {
      localStorage.setItem("zen_ai_language", lang);
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_ai_language", lang);
  };

  const setCommitMessageLanguage = (lang: "en" | "vi") => {
    setCommitMessageLanguageState(lang);
    try {
      localStorage.setItem("zen_commit_message_language", lang);
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_commit_message_language", lang);
  };

  const setApiUrl = (url: string) => {
    setApiUrlState(url);
    const storage = extensionService.getStorage();
    storage.set("backend-api-url", url);
  };

  const setPermissionMode = (mode: PermissionMode) => {
    setPermissionModeState(mode);
    const storage = extensionService.getStorage();
    storage.set("zen_permission_mode", mode);
  };

  const setToolPermission = (
    toolId: string,
    value: "full_access" | "review",
  ) => {
    setToolPermissionsState((prev) => {
      const next = { ...prev, [toolId]: value };
      const storage = extensionService.getStorage();
      storage.set("zen_tool_permissions", JSON.stringify(next));
      return next;
    });
  };

  const setAllToolPermissions = (value: "full_access" | "review") => {
    const next = Object.fromEntries(
      Object.keys(defaultToolPermissions).map((k) => [k, value]),
    ) as Record<string, "full_access" | "review">;
    setToolPermissionsState(next);
    const storage = extensionService.getStorage();
    storage.set("zen_tool_permissions", JSON.stringify(next));
  };

  const setIsSimpleMode = (value: boolean) => {
    setIsSimpleModeState(value);
    try {
      localStorage.setItem("zen-simple-mode", String(value));
    } catch (e) {}
  };

  const setLiveWritePreview = (value: boolean) => {
    setLiveWritePreviewState(value);
    try {
      localStorage.setItem("zen-live-write-preview", String(value));
    } catch (e) {}
  };

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage,
        aiLanguage,
        setAiLanguage,
        commitMessageLanguage,
        setCommitMessageLanguage,
        apiUrl,
        setApiUrl,
        toolPermissions: toolPermissionsState,
        setToolPermission,
        setAllToolPermissions,
        permissionMode: permissionModeState,
        setPermissionMode,
        isSimpleMode,
        setIsSimpleMode,
        liveWritePreview,
        setLiveWritePreview,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
