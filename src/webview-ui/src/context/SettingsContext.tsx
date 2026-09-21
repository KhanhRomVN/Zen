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
  /** ID của database manager đang được chọn cho workspace hiện tại */
  activeDatabaseManagerId: string | null;
  setActiveDatabaseManagerId: (id: string | null) => void;
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
  // Backend (SQLite) là nguồn chân lý duy nhất → không cache ở localStorage.
  const [chromiumProfileDir, setChromiumProfileDirState] =
    useState<string>("");
  // Timer debounce cho việc PUT chromium_profile_dir lên backend.
  const chromiumSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Key lưu per-workspace: dùng workspace path để phân biệt
  const workspaceKey = () => {
    try {
      const wp = (window as any).__zenWorkspaceFolderPath as string | null;
      return wp ? `zen_active_db_manager__${wp}` : "zen_active_db_manager__global";
    } catch {
      return "zen_active_db_manager__global";
    }
  };

  const [activeDatabaseManagerId, setActiveDatabaseManagerIdState] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem(workspaceKey());
      } catch {
        return null;
      }
    },
  );
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
        // Luôn áp giá trị từ backend; null nghĩa là chưa cấu hình → input rỗng.
        setChromiumProfileDirState(chromium_profile_dir ?? "");
        // Dọn key cache cũ còn sót từ phiên bản trước.
        try {
          localStorage.removeItem("zen_chromium_profile_dir");
        } catch (e) {}
      })
      .catch(() => {
        /* backend chưa sẵn sàng — giữ giá trị hiện tại trong state */
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

  const setChromiumProfileDir = (path: string) => {
    setChromiumProfileDirState(path);
    if (chromiumSaveTimer.current) clearTimeout(chromiumSaveTimer.current);
    if (!apiUrl) return;
    // Debounce 500ms: chỉ gửi giá trị cuối cùng thay vì PUT mỗi lần gõ phím.
    chromiumSaveTimer.current = setTimeout(() => {
      fetch(`${apiUrl}/v1/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chromium_profile_dir: path }),
      })
        .then((r) => {
          if (!r.ok) {
            console.warn(
              "[Settings] save chromium_profile_dir rejected",
              r.status,
            );
          }
        })
        .catch((e) =>
          console.warn("[Settings] save chromium_profile_dir failed", e),
        );
    }, 500);
  };

  const setActiveDatabaseManagerId = (id: string | null) => {
    setActiveDatabaseManagerIdState(id);
    try {
      const key = workspaceKey();
      if (id) {
        localStorage.setItem(key, id);
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {}
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
        activeDatabaseManagerId,
        setActiveDatabaseManagerId,
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
