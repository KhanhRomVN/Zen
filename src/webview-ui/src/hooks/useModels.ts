import { useState, useEffect } from "react";

export interface Model {
  id: string;
  name: string;
  provider: "deepseek" | "chatgpt" | "gemini" | "grok" | "claude";
}

const DEFAULT_MODELS: Model[] = [
  { id: "deepseek-web", name: "DeepSeek Web", provider: "deepseek" },
  { id: "chatgpt-web", name: "ChatGPT Web", provider: "chatgpt" },
  { id: "grok-web", name: "Grok Web", provider: "grok" },
  { id: "claude-web", name: "Claude Web", provider: "claude" },
  { id: "gemini-web", name: "Gemini Web", provider: "gemini" },
];

export const useModels = () => {
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>("deepseek-web");

  const addModel = (
    model: Omit<Model, "provider"> & { provider?: Model["provider"] }
  ) => {
    const newModel: Model = {
      ...model,
      provider: model.provider || "deepseek",
    };
    setModels([...models, newModel]);
  };

  const updateModel = (
    id: string,
    updatedModel: Omit<Model, "provider"> & { provider?: Model["provider"] }
  ) => {
    setModels(
      models.map((m) => {
        if (m.id === id) {
          return {
            ...updatedModel,
            provider: updatedModel.provider || m.provider,
          };
        }
        return m;
      })
    );
  };

  const deleteModel = (id: string) => {
    setModels(models.filter((m) => m.id !== id));
  };

  return {
    models,
    selectedModel,
    setSelectedModel,
    addModel,
    updateModel,
    deleteModel,
  };
};
