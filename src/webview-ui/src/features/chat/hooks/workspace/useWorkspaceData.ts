import { useState, useEffect, useRef } from "react";
import { Rule, WorkspaceItem } from "../../types/workspace";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useWorkspaceData');

export const useWorkspaceData = () => {
  const renderCountRef = useRef(0);
  const filesUpdateCountRef = useRef(0);
  const foldersUpdateCountRef = useRef(0);
  
  renderCountRef.current += 1;

  const [availableFiles, setAvailableFiles] = useState<WorkspaceItem[]>([]);
  const [availableFolders, setAvailableFolders] = useState<WorkspaceItem[]>([]);
  const [availableRules, setAvailableRules] = useState<Rule[]>([]);

  log.render('useWorkspaceData', {
    renderCount: renderCountRef.current,
    filesCount: availableFiles.length,
    foldersCount: availableFolders.length,
    rulesCount: availableRules.length
  });

  // Listen for workspace files/folders responses from extension
  useEffect(() => {
    const setupStartTime = performance.now();
    
    log.state('workspaceData_setup', {});

    const handleWorkspaceResponse = (event: MessageEvent) => {
      const eventStartTime = performance.now();
      const data = event.data;

      if (data.command === "workspaceFilesResponse") {
        if (data.files && !data.error) {
          filesUpdateCountRef.current += 1;
          log.state('workspace_files_update', {
            updateCount: filesUpdateCountRef.current,
            filesCount: data.files.length
          });
          setAvailableFiles(data.files);
        } else if (data.error) {
          log.state('workspace_files_error', { error: data.error });
        }
      } else if (data.command === "workspaceFoldersResponse") {
        if (data.folders && !data.error) {
          foldersUpdateCountRef.current += 1;
          log.state('workspace_folders_update', {
            updateCount: foldersUpdateCountRef.current,
            foldersCount: data.folders.length
          });
          setAvailableFolders(data.folders);
        } else if (data.error) {
          log.state('workspace_folders_error', { error: data.error });
        }
      }
      
      log.perf('handleWorkspaceResponse', eventStartTime, {
        command: data.command
      });
    };

    window.addEventListener("message", handleWorkspaceResponse);

    // Eagerly fetch workspace folders to ensure we have a fallback path
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      log.state('fetch_workspace_folders', {});
      vscodeApi.postMessage({ command: "getWorkspaceFolders" });
    }

    log.perf('workspaceData_setup_complete', setupStartTime, {});

    return () => {
      log.state('workspaceData_cleanup', {});
      window.removeEventListener("message", handleWorkspaceResponse);
    };
  }, []);

  // Load rules from localStorage
  useEffect(() => {
    const loadStartTime = performance.now();
    const stored = localStorage.getItem("zen-rules");
    
    if (stored) {
      try {
        const rules = JSON.parse(stored);
        log.state('rules_loaded', { rulesCount: rules.length });
        setAvailableRules(rules);
      } catch (error) {
        log.state('rules_load_error', { error: String(error) });
      }
    } else {
      log.state('rules_not_found', {});
    }
    
    log.perf('load_rules', loadStartTime, {});
  }, []);

  return {
    availableFiles,
    availableFolders,
    availableRules,
  };
};
