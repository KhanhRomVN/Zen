import React, { createContext, useContext, useState, useEffect } from "react";

interface SettingsContextType {
  language: string;
  setLanguage: (lang: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState("en");
  const [apiUrl, setApiUrlState] = useState("http://localhost:8888");

  useEffect(() => {
    const storage = (window as any).storage;
    if (storage) {
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
    }
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    const storage = (window as any).storage;
    if (storage) {
      storage.set("zen_preferred_language", lang);
    }
  };

  const setApiUrl = (url: string) => {
    setApiUrlState(url);
    const storage = (window as any).storage;
    if (storage) {
      storage.set("backend-api-url", url);
    }
  };

  return (
    <SettingsContext.Provider
      value={{ language, setLanguage, apiUrl, setApiUrl }}
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
