import { useState } from "react";

export interface Model {
  id: string;
  name: string;
  provider: string;
}

export const useModels = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  return {
    models,
    setModels,
    selectedModel,
    setSelectedModel,
  };
};
