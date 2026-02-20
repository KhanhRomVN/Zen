import React, { createContext, useContext, useState, useEffect } from "react";
import { extensionService } from "../services/ExtensionService";

interface SettingsContextType {
  language: string;
  setLanguage: (lang: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  isBackupEnabled: boolean;
  setIsBackupEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState("en");
  const [apiUrl, setApiUrlState] = useState("http://localhost:8888");
  const [isBackupEnabled, setIsBackupEnabledState] = useState(true);

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

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage,
        apiUrl,
        setApiUrl,
        isBackupEnabled,
        setIsBackupEnabled,
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
