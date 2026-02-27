import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { extensionService } from "../services/ExtensionService";

interface ProjectContextType {
  workspace: string;
  rules: string;
  treeView: string;
  isLoading: boolean;
  error: string | null;
  refreshContext: () => void;
  startWatching: () => void;
  stopWatching: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [workspace, setWorkspace] = useState("");
  const [rules, setRules] = useState("");
  const [treeView, setTreeView] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshContext = useCallback(() => {
    setIsLoading(true);
    const requestId = `manual-refresh-${Date.now()}`;
    extensionService.postMessage({
      command: "getProjectContext",
      requestId,
    });
  }, []);

  const startWatching = useCallback(() => {
    extensionService.postMessage({
      command: "startProjectContextWatch",
    });
  }, []);

  const stopWatching = useCallback(() => {
    extensionService.postMessage({
      command: "stopProjectContextWatch",
    });
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "projectContextResult") {
        console.log(
          "[ProjectContext] Received projectContextResult:",
          message.data,
        );
        if (message.data) {
          setWorkspace(message.data.workspace || "");
          setTreeView(message.data.treeView || "");
        }
        setRules(message.data.rules || "");
        setTreeView(message.data.treeView || "");
        setError(null);
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);

    // Initial fetch
    refreshContext();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [refreshContext]);

  return (
    <ProjectContext.Provider
      value={{
        workspace,
        rules,
        treeView,
        isLoading,
        error,
        refreshContext,
        startWatching,
        stopWatching,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};
