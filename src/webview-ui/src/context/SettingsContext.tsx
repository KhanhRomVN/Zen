import React, { createContext, useContext, useState, useEffect } from "react";
import { extensionService } from "../services/ExtensionService";
import type { LanguageCode } from "../i18n";

export type PermissionMode =
  | "bypassPermissions"
  | "acceptEdits"
  | "auto"
  | "default"
  | "dontAsk"
  | "plan";

interface SettingsContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  aiLanguage: string;
  setAiLanguage: (lang: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  toolPermissions: Record<string, "full_access" | "review">;
  setToolPermission: (toolId: string, value: "full_access" | "review") => void;
  setAllToolPermissions: (value: "full_access" | "review") => void;
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
}

export const defaultToolPermissions: Record<string, "full_access" | "review"> = {
  read_file: "full_access",
  write_to_file: "full_access",
  replace_in_file: "full_access",
  list_files: "full_access",
  search_files: "full_access",
  run_command: "full_access",
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [aiLanguage, setAiLanguageState] = useState<string>("English");
  const [apiUrl, setApiUrlState] = useState("http://localhost:8888");
  const [permissionModeState, setPermissionModeState] = useState<PermissionMode>("bypassPermissions");
  const [toolPermissionsState, setToolPermissionsState] = useState<
    Record<string, "full_access" | "review">
  >(defaultToolPermissions);

  useEffect(() => {
    const storage = extensionService.getStorage();

    storage.get("zen_preferred_language").then((res: any) => {
      if (res?.value && typeof res.value === "string" && res.value.length < 10) {
        setLanguageState(res.value === "vi" ? "vi" : "en");
      }
    });

    storage.get("zen_ai_language").then((res: any) => {
      if (res?.value) setAiLanguageState(res.value);
    });

    storage.get("backend-api-url").then((res: any) => {
      if (res?.value) {
        setApiUrlState(res.value);
      }
    });

    storage.get("zen_permission_mode").then((res: any) => {
      if (res?.value) {
        setPermissionModeState(res.value as PermissionMode);
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
    const storage = extensionService.getStorage();
    storage.set("zen_preferred_language", lang);
  };

  const setAiLanguage = (lang: string) => {
    setAiLanguageState(lang);
    const storage = extensionService.getStorage();
    storage.set("zen_ai_language", lang);
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

  const setToolPermission = (toolId: string, value: "full_access" | "review") => {
    setToolPermissionsState((prev) => {
      const next = { ...prev, [toolId]: value };
      const storage = extensionService.getStorage();
      storage.set("zen_tool_permissions", JSON.stringify(next));
      return next;
    });
  };

  const setAllToolPermissions = (value: "full_access" | "review") => {
    const next = Object.fromEntries(Object.keys(defaultToolPermissions).map((k) => [k, value])) as Record<string, "full_access" | "review">;
    setToolPermissionsState(next);
    const storage = extensionService.getStorage();
    storage.set("zen_tool_permissions", JSON.stringify(next));
  };

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage,
        aiLanguage,
        setAiLanguage,
        apiUrl,
        setApiUrl,
        toolPermissions: toolPermissionsState,
        setToolPermission,
        setAllToolPermissions,
        permissionMode: permissionModeState,
        setPermissionMode,
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
