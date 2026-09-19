import React, { createContext, useContext, useState, useEffect } from "react";
import { extensionService } from "../services/ExtensionService";
import type {
  SystemPromptMode,
  PromptLengthMode,
} from "@/features/chat/prompts";
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
  promptLengthMode: PromptLengthMode;
  setPromptLengthMode: (mode: PromptLengthMode) => void;
  /** System path tới thư mục chứa các profile Chromium */
  chromiumProfileDir: string;
  setChromiumProfileDir: (path: string) => void;
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
  const [commitMessageLanguage, setCommitMessageLanguageState] =
    useState<string>(() => {
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
  const [promptLengthModeState, setPromptLengthModeState] =
    useState<PromptLengthMode>(() => {
      try {
        const saved = localStorage.getItem("zen_prompt_length_mode");
        if (
          saved === "short" ||
          saved === "medium" ||
          saved === "long" ||
          saved === "none"
        ) {
          return saved;
        }
      } catch (e) {}
      return "long";
    });
  const [chromiumProfileDir, setChromiumProfileDirState] = useState<string>(
    () => {
      try {
        const saved = localStorage.getItem("zen_chromium_profile_dir");
        if (saved) return saved;
      } catch (e) {}
      return "";
    },
  );
  const [databasePath, setDatabasePathState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("zen_database_path");
      if (saved) return saved;
    } catch (e) {}
    return "";
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

  // Khi apiUrl đổi → fetch config từ backend để đồng bộ (backend là nguồn chân lý).
  useEffect(() => {
    if (!apiUrl) return;
    let cancelled = false;
    fetch(`${apiUrl}/v1/config`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res?.success || !res.data) return;
        const { chromium_profile_dir } = res.data;
        if (chromium_profile_dir != null) {
          setChromiumProfileDirState(chromium_profile_dir);
          try {
            localStorage.setItem(
              "zen_chromium_profile_dir",
              chromium_profile_dir,
            );
          } catch (e) {}
        }
      })
      .catch(() => {
        /* backend chưa sẵn sàng — giữ giá trị local cache */
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

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

  const setPromptLengthMode = (mode: PromptLengthMode) => {
    setPromptLengthModeState(mode);
    try {
      localStorage.setItem("zen_prompt_length_mode", mode);
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set("zen_prompt_length_mode", mode);
  };

  const setDatabasePath = (path: string) => {
    setDatabasePathState(path);
    try {
      localStorage.setItem("zen_database_path", path);
    } catch (e) {}
    // Đồng bộ backend (fire-and-forget); backend là nguồn chân lý.
    if (apiUrl) {
      fetch(`${apiUrl}/v1/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database_path: path }),
      }).catch((e) => console.warn("[Settings] save database_path failed", e));
    }
  };

  const setChromiumProfileDir = (path: string) => {
    setChromiumProfileDirState(path);
    try {
      localStorage.setItem("zen_chromium_profile_dir", path);
    } catch (e) {}
    if (apiUrl) {
      fetch(`${apiUrl}/v1/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chromium_profile_dir: path }),
      }).catch((e) =>
        console.warn("[Settings] save chromium_profile_dir failed", e),
      );
    }
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
        promptLengthMode: promptLengthModeState,
        setPromptLengthMode,
        chromiumProfileDir,
        setChromiumProfileDir,
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
