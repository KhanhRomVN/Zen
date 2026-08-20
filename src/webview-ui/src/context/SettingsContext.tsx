import React, { createContext, useContext, useState, useEffect } from "react";
import { extensionService } from "../services/ExtensionService";
import type { SystemPromptMode } from "@/features/chat/prompts";
import { PermissionMode } from "@/features/chat/types/tag-types";

export type TargetOSEnvironment = "auto" | "windows" | "linux";

interface SettingsContextType {
  aiLanguage: string;
  setAiLanguage: (lang: string) => void;
  commitMessageLanguage: "en" | "vi";
  setCommitMessageLanguage: (lang: "en" | "vi") => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
  liveWritePreview: boolean;
  setLiveWritePreview: (value: boolean) => void;
  systemPromptMode: SystemPromptMode;
  setSystemPromptMode: (mode: SystemPromptMode) => void;
  targetOS: TargetOSEnvironment;
  setTargetOS: (os: TargetOSEnvironment) => void;
  maxFilesPerSession: number;
  setMaxFilesPerSession: (value: number) => void;
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
    "en" | "vi"
  >(() => {
    try {
      const saved = localStorage.getItem("zen_commit_message_language");
      if (saved === "vi" || saved === "en") return saved;
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
        if (saved === "simple" || saved === "promax")
          return saved;
      } catch (e) {}
      return "simple";
    });
  const [targetOSState, setTargetOSState] = useState<TargetOSEnvironment>(() => {
    try {
      const saved = localStorage.getItem("zen_target_os") as TargetOSEnvironment;
      if (saved === "auto" || saved === "windows" || saved === "linux")
        return saved;
    } catch (e) {}
    return "auto";
  });

  const [maxFilesPerSessionState, setMaxFilesPerSessionState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("zen_max_files_per_session");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
          return parsed;
        }
      }
    } catch (e) {}
    return 5;
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

    storage.get("zen_max_files_per_session").then((res: any) => {
      if (res?.value) {
        const parsed = parseInt(res.value, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
          setMaxFilesPerSessionState(parsed);
        }
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

  const setTargetOS = (os: TargetOSEnvironment) => {
    setTargetOSState(os);
    try {
      localStorage.setItem("zen_target_os", os);
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_target_os", os);
  };

  const setMaxFilesPerSession = (value: number) => {
    const clamped = Math.max(1, Math.min(100, value));
    setMaxFilesPerSessionState(clamped);
    try {
      localStorage.setItem("zen_max_files_per_session", String(clamped));
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_max_files_per_session", String(clamped));
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
        targetOS: targetOSState,
        setTargetOS,
        maxFilesPerSession: maxFilesPerSessionState,
        setMaxFilesPerSession,
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
