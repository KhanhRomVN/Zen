import React, { createContext, useContext, useState, useEffect } from "react";
import { extensionService } from "../services/ExtensionService";
import type { SystemPromptMode } from "@/features/chat/prompts";
import { PermissionMode } from "@/features/chat/types/tag-types";

interface SettingsContextType {
  aiLanguage: string;
  setAiLanguage: (lang: string) => void;
  commitMessageLanguage: string;
  setCommitMessageLanguage: (lang: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
  liveWritePreview: boolean;
  setLiveWritePreview: (value: boolean) => void;
  systemPromptMode: SystemPromptMode;
  setSystemPromptMode: (mode: SystemPromptMode) => void;
  useCustomLSP: boolean;
  setUseCustomLSP: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [aiLanguage, setAiLanguageState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("zen_ai_language");
      if (saved) return saved;
    } catch (e) {}
    return "English";
  });
  const [commitMessageLanguage, setCommitMessageLanguageState] = useState<
    string
  >(() => {
    try {
      const saved = localStorage.getItem("zen_commit_message_language");
      if (saved) return saved;
    } catch (e) {}
    return "en";
  });
  const [apiUrl, setApiUrlState] = useState("http://localhost:8888");
  const [permissionModeState, setPermissionModeState] =
    useState<PermissionMode>("fullAccess");
  const [liveWritePreview, setLiveWritePreviewState] = useState<boolean>(true);
  const [systemPromptModeState, setSystemPromptModeState] =
    useState<SystemPromptMode>(() => {
      try {
        const saved = localStorage.getItem("zen_system_prompt_mode");
        if (
          saved === "fast" ||
          saved === "balanced" ||
          saved === "thorough" ||
          saved === "autopilot"
        ) {
          return saved;
        }
      } catch (e) {}
      return "balanced";
    });
  const [useCustomLSP, setUseCustomLSPState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("zen_use_custom_lsp");
      return saved === "true";
    } catch (e) {}
    return false;
  });

  useEffect(() => {
    const storage = extensionService.getStorage();

    storage.get("backend-api-url").then((res: any) => {
      if (res?.value) {
        setApiUrlState(res.value);
      }
    });

    storage.get("zen_permission_mode").then((res: any) => {
      if (res?.value) {
        setPermissionModeState(res.value);
      }
    });
  }, []);

  const setAiLanguage = (lang: string) => {
    setAiLanguageState(lang);
    try {
      localStorage.setItem("zen_ai_language", lang);
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_ai_language", lang);
  };

  const setCommitMessageLanguage = (lang: string) => {
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

  const setLiveWritePreview = (value: boolean) => {
    setLiveWritePreviewState(value);
    try {
      localStorage.setItem("zen-live-write-preview", String(value));
    } catch (e) {}
  };

  const setSystemPromptMode = (mode: SystemPromptMode) => {
    setSystemPromptModeState(mode);
    try {
      localStorage.setItem("zen_system_prompt_mode", mode);
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_system_prompt_mode", mode);
  };

  const setUseCustomLSP = (value: boolean) => {
    setUseCustomLSPState(value);
    try {
      localStorage.setItem("zen_use_custom_lsp", String(value));
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_use_custom_lsp", value);
  };

  return (
    <SettingsContext.Provider
      value={{
        aiLanguage,
        setAiLanguage,
        commitMessageLanguage,
        setCommitMessageLanguage,
        apiUrl,
        setApiUrl,
        permissionMode: permissionModeState,
        setPermissionMode,
        liveWritePreview,
        setLiveWritePreview,
        systemPromptMode: systemPromptModeState,
        setSystemPromptMode,
        useCustomLSP,
        setUseCustomLSP,
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