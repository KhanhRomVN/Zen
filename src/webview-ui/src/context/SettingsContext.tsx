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
  /** Tự động tạo checkpoint trước khi write/replace/delete file */
  checkpointEnabled: boolean;
  setCheckpointEnabled: (value: boolean) => void;
  /** Lấy diagnostics (lỗi/cảnh báo) từ language server sau khi sửa file */
  diagnosticEnabled: boolean;
  setDiagnosticEnabled: (value: boolean) => void;
  /** Hiển thị ResponseMetadataBar (token usage) dưới mỗi response */
  showMetadataBar: boolean;
  setShowMetadataBar: (value: boolean) => void;
  /** Đính kèm danh sách SKILL (tên + mô tả) vào system-prompt */
  useSkillEnabled: boolean;
  setUseSkillEnabled: (value: boolean) => void;
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

  // Đọc boolean từ localStorage; dùng fallback khi chưa có giá trị hợp lệ
  const loadBool = (key: string, fallback: boolean): boolean => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "true") return true;
      if (saved === "false") return false;
    } catch (e) {}
    return fallback;
  };
  const [checkpointEnabled, setCheckpointEnabledState] = useState<boolean>(() =>
    loadBool("zen_checkpoint_enabled", true),
  );
  const [diagnosticEnabled, setDiagnosticEnabledState] = useState<boolean>(() =>
    loadBool("zen_diagnostic_enabled", true),
  );
  const [showMetadataBar, setShowMetadataBarState] = useState<boolean>(() =>
    loadBool("zen_show_metadata_bar", true),
  );
  const [useSkillEnabled, setUseSkillEnabledState] = useState<boolean>(() =>
    loadBool("zen_use_skill_enabled", true),
  );

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

  // Đồng bộ cờ checkpoint/diagnostic sang extension host (FeatureSettingsService)
  // vì các Manager/Service đó chạy độc lập, không đọc được localStorage của webview.
  useEffect(() => {
    extensionService.postMessage({
      command: "syncFeatureSettings",
      checkpointEnabled,
      diagnosticEnabled,
    });
  }, [checkpointEnabled, diagnosticEnabled]);

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

  // Lưu boolean vào localStorage + extension storage (cùng pattern với setSystemPromptMode)
  const persistBool = (key: string, value: boolean) => {
    try {
      localStorage.setItem(key, String(value));
    } catch (e) {}
    const storage = extensionService.getStorage();
    storage.set(key, String(value));
  };

  const setCheckpointEnabled = (value: boolean) => {
    setCheckpointEnabledState(value);
    persistBool("zen_checkpoint_enabled", value);
  };

  const setDiagnosticEnabled = (value: boolean) => {
    setDiagnosticEnabledState(value);
    persistBool("zen_diagnostic_enabled", value);
  };

  const setShowMetadataBar = (value: boolean) => {
    setShowMetadataBarState(value);
    persistBool("zen_show_metadata_bar", value);
  };

  const setUseSkillEnabled = (value: boolean) => {
    setUseSkillEnabledState(value);
    persistBool("zen_use_skill_enabled", value);
  };

  const setActiveDatabaseManagerId = (id: string | null) => {
    const previousId = activeDatabaseManagerId;
    setActiveDatabaseManagerIdState(id);
    try {
      const key = workspaceKey();
      if (id) {
        localStorage.setItem(key, id);
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {}

    // Đổi sang database khác → xóa cache provider/model/account đang dùng
    // của workspace (localStorage + extension storage), tránh MessageInput
    // tự nạp lại lựa chọn thuộc về database trước đó.
    if (previousId !== id) {
      try {
        const wp = (window as any).__zenWorkspaceFolderPath as string | null;
        const modelSelectionKey = `zen-model-selection:${wp || "global"}`;
        localStorage.removeItem(modelSelectionKey);
        const storage = extensionService.getStorage();
        storage.delete(modelSelectionKey).catch(() => {});
      } catch (e) {}
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
        activeDatabaseManagerId,
        setActiveDatabaseManagerId,
        checkpointEnabled,
        setCheckpointEnabled,
        diagnosticEnabled,
        setDiagnosticEnabled,
        showMetadataBar,
        setShowMetadataBar,
        useSkillEnabled,
        setUseSkillEnabled,
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
