/**
 * ------------------------------------------------------------------
 * useModelPromptSettings
 * ------------------------------------------------------------------
 * Quản lý systemPromptMode + promptLengthMode per (providerId, modelId).
 *
 * Mỗi cặp provider/model có preset riêng, lưu vào localStorage với key:
 *   zen_prompt_settings__<providerId>__<modelId>
 *
 * Khi chưa có preset cho model đó → fallback về global default từ
 * SettingsContext (người dùng đã cấu hình trước đó).
 *
 * Khi model thay đổi → tự động load lại preset của model mới.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  SystemPromptMode,
  PromptLengthMode,
} from "@/features/chat/prompts";
import { useSettings } from "../context/SettingsContext";

// ─── Types ────────────────────────────────────────────────────────────────

interface ModelPromptPreset {
  systemPromptMode: SystemPromptMode;
  promptLengthMode: PromptLengthMode;
}

// ─── Storage helpers ──────────────────────────────────────────────────────

const storageKey = (providerId: string, modelId: string) =>
  `zen_prompt_settings__${providerId}__${modelId}`;

const loadPreset = (
  providerId: string,
  modelId: string,
): ModelPromptPreset | null => {
  try {
    const raw = localStorage.getItem(storageKey(providerId, modelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModelPromptPreset>;
    // Validate cả 2 field trước khi trả về
    const validSystemModes: SystemPromptMode[] = [
      "fast",
      "balanced",
      "thorough",
      "autopilot",
      "short",
      "none",
    ];
    const validLengthModes: PromptLengthMode[] = [
      "short",
      "medium",
      "long",
      "none",
    ];
    if (
      parsed.systemPromptMode &&
      validSystemModes.includes(parsed.systemPromptMode) &&
      parsed.promptLengthMode &&
      validLengthModes.includes(parsed.promptLengthMode)
    ) {
      return parsed as ModelPromptPreset;
    }
  } catch (e) {}
  return null;
};

const savePreset = (
  providerId: string,
  modelId: string,
  preset: ModelPromptPreset,
) => {
  try {
    localStorage.setItem(
      storageKey(providerId, modelId),
      JSON.stringify(preset),
    );
  } catch (e) {}
};

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useModelPromptSettings(
  providerId: string | null | undefined,
  modelId: string | null | undefined,
) {
  const {
    systemPromptMode: globalSystemPromptMode,
    setSystemPromptMode: setGlobalSystemPromptMode,
    promptLengthMode: globalPromptLengthMode,
    setPromptLengthMode: setGlobalPromptLengthMode,
  } = useSettings();

  // Khởi tạo từ preset của model (nếu có) hoặc global fallback
  const [systemPromptMode, setSystemPromptModeState] =
    useState<SystemPromptMode>(() => {
      if (providerId && modelId) {
        const preset = loadPreset(providerId, modelId);
        if (preset) return preset.systemPromptMode;
      }
      return globalSystemPromptMode;
    });

  const [promptLengthMode, setPromptLengthModeState] =
    useState<PromptLengthMode>(() => {
      if (providerId && modelId) {
        const preset = loadPreset(providerId, modelId);
        if (preset) return preset.promptLengthMode;
      }
      return globalPromptLengthMode;
    });

  // Track model key để detect khi model thực sự thay đổi
  const prevModelKeyRef = useRef<string | null>(
    providerId && modelId ? `${providerId}__${modelId}` : null,
  );

  // Khi model thay đổi → load preset của model mới và sync vào global context
  // (useChatLLM đọc từ useSettings/global, nên phải sync để UI và data khớp nhau)
  useEffect(() => {
    const modelKey = providerId && modelId ? `${providerId}__${modelId}` : null;
    if (modelKey === prevModelKeyRef.current) return;
    prevModelKeyRef.current = modelKey;

    if (providerId && modelId) {
      const preset = loadPreset(providerId, modelId);
      if (preset) {
        setSystemPromptModeState(preset.systemPromptMode);
        setPromptLengthModeState(preset.promptLengthMode);
        // BUG FIX: sync vào global context để useChatLLM nhận đúng giá trị
        setGlobalSystemPromptMode(preset.systemPromptMode);
        setGlobalPromptLengthMode(preset.promptLengthMode);
      } else {
        // Chưa có preset → dùng global default
        setSystemPromptModeState(globalSystemPromptMode);
        setPromptLengthModeState(globalPromptLengthMode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, modelId]);

  // Setter: lưu per-model + update global default
  const setSystemPromptMode = useCallback(
    (mode: SystemPromptMode) => {
      setSystemPromptModeState(mode);
      setGlobalSystemPromptMode(mode); // Cập nhật global default cho model chưa có preset

      if (providerId && modelId) {
        const current = loadPreset(providerId, modelId);
        savePreset(providerId, modelId, {
          systemPromptMode: mode,
          promptLengthMode: current?.promptLengthMode ?? promptLengthMode,
        });
      }
    },
    [providerId, modelId, promptLengthMode, setGlobalSystemPromptMode],
  );

  const setPromptLengthMode = useCallback(
    (mode: PromptLengthMode) => {
      setPromptLengthModeState(mode);
      setGlobalPromptLengthMode(mode); // Cập nhật global default cho model chưa có preset

      if (providerId && modelId) {
        const current = loadPreset(providerId, modelId);
        savePreset(providerId, modelId, {
          systemPromptMode: current?.systemPromptMode ?? systemPromptMode,
          promptLengthMode: mode,
        });
      }
    },
    [providerId, modelId, systemPromptMode, setGlobalPromptLengthMode],
  );

  return {
    systemPromptMode,
    setSystemPromptMode,
    promptLengthMode,
    setPromptLengthMode,
  };
}
