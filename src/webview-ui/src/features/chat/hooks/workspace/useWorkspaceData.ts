import { useState, useEffect } from "react";
import { Rule, WorkspaceItem } from "../../types/workspace";

export const useWorkspaceData = () => {
  const [availableFiles, setAvailableFiles] = useState<WorkspaceItem[]>([]);
  const [availableFolders, setAvailableFolders] = useState<WorkspaceItem[]>([]);
  const [availableRules, setAvailableRules] = useState<Rule[]>([]);

  // Listen for workspace files/folders responses from extension
  useEffect(() => {
    const handleWorkspaceResponse = (event: MessageEvent) => {
      const data = event.data;

      if (data.command === "workspaceFilesResponse") {
        if (data.files && !data.error) {
          setAvailableFiles(data.files);
        } else if (data.error) {
        }
      } else if (data.command === "workspaceFoldersResponse") {
        if (data.folders && !data.error) {
          setAvailableFolders(data.folders);
        } else if (data.error) {
        }
      }
    };

    window.addEventListener("message", handleWorkspaceResponse);

    // Eagerly fetch workspace folders to ensure we have a fallback path
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "getWorkspaceFolders" });
    }

    return () => {
      window.removeEventListener("message", handleWorkspaceResponse);
    };
  }, []);

  // Load rules from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("zen-rules");
    if (stored) {
      try {
        setAvailableRules(JSON.parse(stored));
      } catch (error) {}
    }
  }, []);

  return {
    availableFiles,
    availableFolders,
    availableRules,
  };
};
