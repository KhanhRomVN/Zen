import { useState, useEffect, useCallback, useRef } from "react";
import { extensionService } from "../services/ExtensionService";

export interface TimelineEvent {
  timestamp: number;
  eventType:
    | "file_modified"
    | "file_added"
    | "file_deleted"
    | "folder_added"
    | "folder_deleted"
    | "initial_state";
  filePath: string;
  fileName: string;
  fileSize?: number;
  snapshotPath?: string;
  unconfirmed?: boolean;
  fileExists?: boolean;
  diff?: {
    additions: number;
    deletions: number;
    diffText?: string;
  };
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
  events: TimelineEvent[];
  isDeleted?: boolean;
  isImplicit?: boolean;
  fileSize?: number;
  unconfirmed?: boolean;
}

export const useBackupTimeline = (conversationId: string, isOpen: boolean) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [largeFilesPrompt, setLargeFilesPrompt] = useState<{
    isOpen: boolean;
    files: Array<{ filePath: string; extension: string; size: number }>;
  }>({
    isOpen: false,
    files: [],
  });

  const fetchTimeline = useCallback(() => {
    if (!conversationId) return;
    setIsLoading(true);
    const requestId = `backup-timeline-${Date.now()}`;
    extensionService.postMessage({
      command: "getBackupTimeline",
      conversationId,
      requestId,
    });

    const handler = (event: MessageEvent) => {
      if (
        event.data.command === "backupTimelineResult" &&
        event.data.requestId === requestId
      ) {
        setTimeline(event.data.timeline || []);
        setIsLoading(false);
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);
    setTimeout(() => {
      window.removeEventListener("message", handler);
      setIsLoading(false);
    }, 10000);
  }, [conversationId]);

  const fetchBlacklist = useCallback(() => {
    extensionService.postMessage({ command: "getBackupBlacklist" });
  }, []);

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchTimeline();
      fetchBlacklist();
    }
  }, [isOpen, conversationId, fetchTimeline, fetchBlacklist]);

  // Tree Building Logic
  useEffect(() => {
    const buildTree = (events: TimelineEvent[]): TreeNode[] => {
      const root: TreeNode[] = [];
      const explicitFolders = new Set<string>();
      const deletedFolders = new Set<string>();

      events.forEach((e) => {
        if (e.eventType === "folder_added") explicitFolders.add(e.filePath);
        if (e.eventType === "folder_deleted") deletedFolders.add(e.filePath);
      });

      const fileMap = new Map<string, TimelineEvent[]>();
      events.forEach((e) => {
        const list = fileMap.get(e.filePath) || [];
        list.push(e);
        fileMap.set(e.filePath, list);
      });

      fileMap.forEach((eventsList, filePath) => {
        eventsList.sort((a, b) => b.timestamp - a.timestamp);
        const parts = filePath.split("/");
        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part, index) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          let node = currentLevel.find((n) => n.name === part);

          if (!node) {
            const isFile =
              index === parts.length - 1 &&
              !eventsList.some((e) => e.eventType.includes("folder"));
            node = {
              name: part,
              path: currentPath,
              type: isFile ? "file" : "folder",
              children: isFile ? undefined : [],
              events: [],
              isDeleted: deletedFolders.has(currentPath),
              isImplicit: !isFile && !explicitFolders.has(currentPath),
              unconfirmed: false,
            };
            currentLevel.push(node);
          }

          if (currentPath === filePath) {
            node.events = eventsList;
            if (node.type === "file") {
              node.fileSize = eventsList[0].fileSize;
              node.unconfirmed = eventsList.some((e) => e.unconfirmed);
            }
          }

          if (node.children) currentLevel = node.children;
        });
      });

      const sort = (nodes: TreeNode[]) => {
        nodes.sort((a, b) =>
          a.type === b.type
            ? a.name.localeCompare(b.name)
            : a.type === "folder"
              ? -1
              : 1,
        );
        nodes.forEach((n) => n.children && sort(n.children));
      };
      sort(root);
      return root;
    };

    setTreeData(buildTree(timeline));
  }, [timeline]);

  // Listen for real-time updates and decisions
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (
        message.command === "backupEventAdded" &&
        message.conversationId === conversationId &&
        isOpen
      ) {
        fetchTimeline();
      } else if (message.command === "backupBlacklistResult") {
        setBlacklist(message.blacklist || []);
      } else if (message.command === "promptLargeBinaryBackup") {
        setLargeFilesPrompt((prev) => ({
          isOpen: true,
          files: [
            ...prev.files,
            {
              filePath: message.filePath,
              extension: message.extension,
              size: message.size,
            },
          ],
        }));
      } else if (
        message.command === "deleteBackupFileResult" &&
        message.success
      ) {
        fetchTimeline();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [conversationId, isOpen, fetchTimeline]);

  const deleteBackupFile = useCallback(
    (filePath: string) => {
      extensionService.postMessage({
        command: "deleteBackupFile",
        conversationId,
        filePath,
      });
    },
    [conversationId],
  );

  const revertToSnapshot = useCallback(
    (event: TimelineEvent) => {
      if (!event.snapshotPath) return;
      extensionService.postMessage({
        command: "revertToSnapshot",
        conversationId,
        filePath: event.filePath,
        snapshotPath: event.snapshotPath,
        eventType: event.eventType,
      });
    },
    [conversationId],
  );

  const openSnapshotDiffWithCurrent = useCallback(
    (event: TimelineEvent) => {
      if (!event.snapshotPath) return;
      extensionService.postMessage({
        command: "openSnapshotDiffWithCurrent",
        conversationId,
        fileEvent: event,
      });
    },
    [conversationId],
  );

  const handleLargeBinaryDecision = useCallback(
    (extension: string, allow: boolean) => {
      extensionService.postMessage({
        command: "backupBinaryFileDecision",
        extension,
        allow,
      });
      setLargeFilesPrompt((prev) => ({
        ...prev,
        files: prev.files.filter((f) => f.extension !== extension),
      }));
      setTimeout(fetchTimeline, 500);
    },
    [fetchTimeline],
  );

  return {
    timeline,
    treeData,
    isLoading,
    blacklist,
    largeFilesPrompt,
    setLargeFilesPrompt,
    deleteBackupFile,
    revertToSnapshot,
    openSnapshotDiffWithCurrent,
    handleLargeBinaryDecision,
    refreshTimeline: fetchTimeline,
  };
};
