import React, { createContext, useContext, useState, useEffect } from "react";
import { extensionService } from "../services/ExtensionService";

interface SettingsContextType {
  language: string;
  setLanguage: (lang: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  isBackupEnabled: boolean;
  setIsBackupEnabled: (enabled: boolean) => void;
  toolPermissions: Record<string, "auto" | "request">;
  setToolPermission: (toolId: string, value: "auto" | "request") => void;
}

export const defaultToolPermissions: Record<string, "auto" | "request"> = {
  read_file: "auto",
  write_to_file: "auto",
  replace_in_file: "auto",
  list_files: "auto",
  search_files: "auto",
  ask_bypass_gitignore: "auto",
  run_command: "auto",
  read_workspace_context: "auto",
  update_workspace_context: "auto",
  get_file_outline: "auto",
  get_symbol_definition: "auto",
  get_references: "auto",
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState("en");
  const [apiUrl, setApiUrlState] = useState("http://localhost:8888");
  const [isBackupEnabled, setIsBackupEnabledState] = useState(true);
  const [toolPermissionsState, setToolPermissionsState] = useState<
    Record<string, "auto" | "request">
  >(defaultToolPermissions);

  useEffect(() => {
    const storage = extensionService.getStorage();

    storage.get("zen_preferred_language").then((res: any) => {
      if (
        res?.value &&
        typeof res.value === "string" &&
        res.value.length < 10
      ) {
        setLanguageState(res.value);
      }
    });

    storage.get("backend-api-url").then((res: any) => {
      if (res?.value) {
        setApiUrlState(res.value);
      }
    });

    storage.get("zen_backup_enabled").then((res: any) => {
      if (res?.value !== undefined) {
        setIsBackupEnabledState(res.value === "true" || res.value === true);
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

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    const storage = extensionService.getStorage();
    storage.set("zen_preferred_language", lang);
  };

  const setApiUrl = (url: string) => {
    setApiUrlState(url);
    const storage = extensionService.getStorage();
    storage.set("backend-api-url", url);
  };

  const setIsBackupEnabled = (enabled: boolean) => {
    setIsBackupEnabledState(enabled);
    const storage = extensionService.getStorage();
    storage.set("zen_backup_enabled", enabled);
  };

  const setToolPermission = (toolId: string, value: "auto" | "request") => {
    setToolPermissionsState((prev) => {
      const next = { ...prev, [toolId]: value };
      const storage = extensionService.getStorage();
      storage.set("zen_tool_permissions", JSON.stringify(next));
      return next;
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage,
        apiUrl,
        setApiUrl,
        isBackupEnabled,
        setIsBackupEnabled,
        toolPermissions: toolPermissionsState,
        setToolPermission,
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
