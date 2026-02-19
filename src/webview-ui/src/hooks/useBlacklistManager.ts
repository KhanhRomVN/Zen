import { useState, useEffect, useCallback } from "react";
import { extensionService } from "../services/ExtensionService";

export interface TreeNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: TreeNode[];
}

export const useBlacklistManager = () => {
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(() => {
    setIsLoading(true);
    extensionService.postMessage({ command: "getBackupBlacklist" });
    extensionService.postMessage({ command: "getWorkspaceTree" });
  }, []);

  useEffect(() => {
    fetchData();

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "backupBlacklistResult") {
        setBlacklist(message.blacklist || []);
        setIsLoading(false);
      } else if (message.command === "workspaceTreeResult") {
        setTreeData(message.tree);
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchData]);

  const toggleBlacklist = useCallback(
    (path: string, isBlacklisted: boolean) => {
      if (isBlacklisted) {
        extensionService.postMessage({
          command: "removeFromBackupBlacklist",
          path,
        });
      } else {
        extensionService.postMessage({
          command: "addToBackupBlacklist",
          path,
        });
      }
    },
    [],
  );

  const checkIsBlacklisted = useCallback(
    (filePath: string) => {
      const normalizedPath = filePath.replace(/\\/g, "/");
      let blacklisted = false;
      for (const pattern of blacklist) {
        const isNegation = pattern.startsWith("!");
        const actualPattern = (isNegation ? pattern.slice(1) : pattern).replace(
          /\\/g,
          "/",
        );
        if (
          normalizedPath === actualPattern ||
          normalizedPath.startsWith(actualPattern + "/")
        ) {
          blacklisted = !isNegation;
        }
      }
      return blacklisted;
    },
    [blacklist],
  );

  return {
    blacklist,
    treeData,
    isLoading,
    fetchData,
    toggleBlacklist,
    checkIsBlacklisted,
  };
};
