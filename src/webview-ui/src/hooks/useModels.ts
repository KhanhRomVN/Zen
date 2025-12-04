import { useState, useEffect } from "react";

export interface Model {
  id: string;
  name: string;
}

const DEFAULT_MODELS: Model[] = [
  { id: "deepseek-web", name: "Deepseek" },
  { id: "gemini-web", name: "Gemini" },
  { id: "chatgpt-web", name: "ChatGPT" },
  { id: "claude-web", name: "Claude" },
  { id: "grok-web", name: "Grok" },
];

const STORAGE_KEY = "zen-models";
const SELECTED_MODEL_KEY = "zen-selected-model";

export const useModels = () => {
  const [models, setModels] = useState<Model[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_MODELS;
    } catch {
      return DEFAULT_MODELS;
    }
  });

  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(SELECTED_MODEL_KEY);
      return stored || DEFAULT_MODELS[0].id;
    } catch {
      return DEFAULT_MODELS[0].id;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
    } catch (error) {
      console.error("Failed to save models:", error);
    }
  }, [models]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_MODEL_KEY, selectedModel);
    } catch (error) {
      console.error("Failed to save selected model:", error);
    }
  }, [selectedModel]);

  const addModel = (model: Model) => {
    setModels((prev) => [...prev, model]);
  };

  const updateModel = (oldId: string, newModel: Model) => {
    setModels((prev) => prev.map((m) => (m.id === oldId ? newModel : m)));
  };

  const deleteModel = (id: string) => {
    setModels((prev) => {
      const filtered = prev.filter((m) => m.id !== id);
      // Đảm bảo luôn có ít nhất 1 model
      return filtered.length > 0 ? filtered : DEFAULT_MODELS;
    });
    // Nếu model đang được chọn bị xóa, chọn model đầu tiên
    if (selectedModel === id) {
      setSelectedModelState(models[0]?.id || DEFAULT_MODELS[0].id);
    }
  };

  const setSelectedModel = (id: string) => {
    setSelectedModelState(id);
  };

  const resetToDefaults = () => {
    setModels(DEFAULT_MODELS);
    setSelectedModelState(DEFAULT_MODELS[0].id);
  };

  return {
    models,
    selectedModel,
    addModel,
    updateModel,
    deleteModel,
    setSelectedModel,
    resetToDefaults,
  };
};
