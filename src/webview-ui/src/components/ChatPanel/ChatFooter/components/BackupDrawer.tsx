import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Edit,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  FileText,
  EllipsisVertical,
  History,
  Check,
  Undo2,
  Ban,
  List,
  Network,
} from "lucide-react";
import {
  getFileIconPath,
  getFolderIconPath,
} from "../../../../utils/fileIconMapper";
import LargeBinaryBackupDrawer from "./LargeBinaryBackupDrawer";

// 🆕 Custom DatabaseBackup Icon
const DatabaseBackupIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-database-backup-icon lucide-database-backup"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 12a9 3 0 0 0 5 2.69" />
    <path d="M21 9.3V5" />
    <path d="M3 5v14a9 3 0 0 0 6.47 2.88" />
    <path d="M12 12v4h4" />
    <path d="M13 20a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L12 16" />
  </svg>
);

const BanIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-ban"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

// 🆕 FileDiff Icon
const FileDiffIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-file-diff-icon lucide-file-diff"
  >
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M9 10h6" />
    <path d="M12 13V7" />
    <path d="M9 17h6" />
  </svg>
);

interface TimelineEvent {
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
  unconfirmed?: boolean; // 🆕 Mark binary files that haven't been confirmed/denied by user
  fileExists?: boolean; // 🆕 Check if file still exists in workspace
  diff?: {
    additions: number;
    deletions: number;
    diffText?: string;
  };
}

// Tree Node Structure
interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
  events: TimelineEvent[];
  isDeleted?: boolean;
  isImplicit?: boolean;
  fileSize?: number;
  unconfirmed?: boolean; // 🆕 If file has unconfirmed events
}

interface BackupDrawerProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

const BackupDrawer: React.FC<BackupDrawerProps> = ({
  conversationId,
  isOpen,
  onClose,
}) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);

  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [isListView, setIsListView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkIsBlacklisted = (filePath: string) => {
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
  };

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    filePath: string;
    fileName: string;
  } | null>(null);

  const [hoveredNodePath, setHoveredNodePath] = useState<string | null>(null);

  // 🆕 Large Binary Batch Confirmation State
  const [largeFilesPrompt, setLargeFilesPrompt] = useState<{
    isOpen: boolean;
    files: Array<{ filePath: string; extension: string; size: number }>;
  }>({
    isOpen: false,
    files: [],
  });

  // Fetch timeline when drawer opens
  useEffect(() => {
    if (isOpen && conversationId) {
      fetchTimeline();
      fetchBlacklist();
    }
  }, [isOpen, conversationId]);

  // Build Tree when timeline changes
  useEffect(() => {
    // 🆕 Filter out blacklisted files before building tree
    const visibleTimeline = timeline.filter(
      (e) => !checkIsBlacklisted(e.filePath),
    );
    const tree = buildTree(visibleTimeline);
    setTreeData(tree);
  }, [timeline, blacklist]);

  // Expand all folders by default when tree changes
  useEffect(() => {
    const expandAll = (nodes: any[]) => {
      const paths = new Set<string>();
      const traverse = (ns: any[]) => {
        ns.forEach((n) => {
          if (n.type === "folder") {
            paths.add(n.path);
            if (n.children) traverse(n.children);
          }
        });
      };
      traverse(nodes);
      setExpandedFolders(paths);
    };

    if (treeData.length > 0 && expandedFolders.size === 0) {
      expandAll(treeData);
    }
  }, [treeData]);

  // 🆕 Listen for real-time backup events
  useEffect(() => {
    const handleNewEvent = (event: MessageEvent) => {
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
      } else if (message.command === "deleteBackupFileResult") {
        if (message.success) {
          fetchTimeline();
          setSelectedEvent(null);
          setSelectedFile(null);
        } else {
          console.error("Failed to delete backup:", message.error);
        }
      }
    };

    window.addEventListener("message", handleNewEvent);
    return () => window.removeEventListener("message", handleNewEvent);
  }, [isOpen, conversationId]);

  // 🆕 Handle binary file decision
  const handleBinaryDecision = (extension: string, allow: boolean) => {
    const vscode = (window as any).vscodeApi;
    if (vscode) {
      vscode.postMessage({
        command: "backupBinaryFileDecision",
        extension,
        allow,
      });

      setLargeFilesPrompt((prev) => ({
        ...prev,
        files: prev.files.filter((f) => f.extension !== extension),
      }));

      setTimeout(fetchTimeline, 500);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Resize logic removed for single panel layout
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Resize logic removed
  };

  const handleMouseUp = () => {
    // Resize logic removed
  };

  useEffect(() => {
    // Resize logic removed
  }, []);

  const buildTree = (events: TimelineEvent[]): TreeNode[] => {
    const root: TreeNode[] = [];
    const explicitFolderPaths = new Set<string>();
    const deletedFolderPaths = new Set<string>();

    events.forEach((e) => {
      if (e.eventType === "folder_added") explicitFolderPaths.add(e.filePath);
      if (e.eventType === "folder_deleted") deletedFolderPaths.add(e.filePath);
    });

    const fileEventsMap = new Map<string, TimelineEvent[]>();
    events.forEach((e) => {
      const list = fileEventsMap.get(e.filePath) || [];
      list.push(e);
      fileEventsMap.set(e.filePath, list);
    });

    fileEventsMap.forEach((eventsList, filePath) => {
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
            isDeleted: deletedFolderPaths.has(currentPath),
            isImplicit: !isFile && !explicitFolderPaths.has(currentPath),
            unconfirmed: false,
          };
          currentLevel.push(node);
        }

        if (currentPath === filePath) {
          node.events = eventsList;
          if (node.type === "file" && eventsList.length > 0) {
            node.fileSize = eventsList[0].fileSize;
            node.unconfirmed = eventsList.some((e) => e.unconfirmed);
          }
          if (eventsList.some((e) => e.eventType === "folder_added")) {
            node.isImplicit = false;
          }
        }

        if (node.children) {
          currentLevel = node.children;
        }
      });
    });

    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === "folder" ? -1 : 1;
      });
      nodes.forEach((n) => {
        if (n.children) sortNodes(n.children);
      });
    };
    sortNodes(root);
    return root;
  };

  const fetchTimeline = async () => {
    setIsLoading(true);
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) return;
    const requestId = `backup-timeline-${Date.now()}`;
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (
        message.command === "backupTimelineResult" &&
        message.requestId === requestId
      ) {
        if (message.timeline) {
          setTimeline(message.timeline);
        }
        setIsLoading(false);
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);
    vscodeApi.postMessage({
      command: "getBackupTimeline",
      conversationId,
      requestId,
    });
    setTimeout(() => {
      window.removeEventListener("message", handler);
      setIsLoading(false);
    }, 10000);
  };

  const deleteBackupFile = (filePath: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      // 🆕 Use extensionService if available, but here we post message directly
      vscodeApi.postMessage({
        command: "deleteBackupFile",
        conversationId,
        filePath,
      });
      // Clear selected file if it was the one deleted
      if (selectedFile === filePath) {
        setSelectedFile(null);
      }
    }
  };

  const openWorkspaceFile = (filePath: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openFile", // Opens the file in VS Code text editor
        path: filePath,
      });
    }
    setContextMenu(null);
  };

  const fetchBlacklist = () => {
    const vscode = (window as any).vscodeApi;
    if (vscode) {
      vscode.postMessage({ command: "getBackupBlacklist" });
    }
  };

  const addToBlacklist = (filePath: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "addToBackupBlacklist",
        path: filePath,
      });
      // 🆕 Also clear selected file if it's the one being blacklisted
      if (selectedFile === filePath) {
        setSelectedFile(null);
      }
    }
    setContextMenu(null);
  };

  const removeFromBlacklist = (filePath: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "removeFromBackupBlacklist",
        path: filePath,
      });
    }
    setContextMenu(null);
  };

  const handleEventClick = async (event: TimelineEvent) => {
    setSelectedEvent(event);
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openDiff",
        conversationId,
        fileEvent: event,
      });
    }
  };

  const handleRevert = async (event: TimelineEvent) => {
    if (!event.snapshotPath) return;

    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "revertToSnapshot",
        conversationId,
        filePath: event.filePath,
        snapshotPath: event.snapshotPath,
        eventType: event.eventType,
      });
    }
  };

  const handleOpenDiffWithCurrent = (event: TimelineEvent) => {
    if (!event.snapshotPath) return;
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openSnapshotDiffWithCurrent",
        conversationId,
        fileEvent: event,
      });
    }
  };

  const toggleFolder = (path: string) => {
    const newSet = new Set(expandedFolders);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    setExpandedFolders(newSet);
  };

  const handleFileSelect = (node: TreeNode) => {
    setSelectedFile(node.path);
  };

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "file_added":
      case "folder_added":
        return <Plus size={14} />;
      case "file_deleted":
      case "folder_deleted":
        return <Trash2 size={14} />;
      case "file_modified":
        return <Edit size={14} />;
      case "initial_state":
        return <History size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "file_added":
      case "folder_added":
        return "var(--vscode-gitDecoration-addedResourceForeground)";
      case "file_deleted":
      case "folder_deleted":
        return "var(--vscode-gitDecoration-deletedResourceForeground)";
      case "file_modified":
        return "var(--vscode-gitDecoration-modifiedResourceForeground)";
      case "initial_state":
        return "var(--vscode-textLink-foreground)";
      default:
        return "var(--secondary-text)";
    }
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return (
      <div
        style={{
          position: "fixed",
          top: contextMenu.y,
          left: Math.min(contextMenu.x, window.innerWidth - 180), // Prevent overflow on the right
          backgroundColor: "var(--vscode-menu-background)",
          color: "var(--vscode-menu-foreground)",
          border: "1px solid var(--vscode-menu-border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          borderRadius: "4px",
          zIndex: 1000,
          minWidth: "160px",
          padding: "4px 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "8px 12px",
            fontSize: "13px",
            borderBottom: "1px solid var(--vscode-menu-separatorBackground)",
            marginBottom: "4px",
            opacity: 0.7,
          }}
        >
          {contextMenu.fileName}
        </div>
        <div
          className="context-menu-item"
          onClick={() => openWorkspaceFile(contextMenu.filePath)}
          style={{
            padding: "6px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--vscode-menu-selectionBackground)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <FileText size={14} />
          <span>View Workspace File</span>
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            deleteBackupFile(contextMenu.filePath);
            setContextMenu(null);
          }}
          style={{
            padding: "6px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--vscode-menu-selectionBackground)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <Trash2 size={14} />
          <span>Delete Backup</span>
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            if (checkIsBlacklisted(contextMenu.filePath)) {
              removeFromBlacklist(contextMenu.filePath);
            } else {
              addToBlacklist(contextMenu.filePath);
            }
            setContextMenu(null);
          }}
          style={{
            padding: "6px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: checkIsBlacklisted(contextMenu.filePath)
              ? "var(--vscode-textLink-foreground)"
              : "var(--vscode-errorForeground)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--vscode-menu-selectionBackground)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <Ban size={14} />
          <span>
            {checkIsBlacklisted(contextMenu.filePath)
              ? "Remove from Blacklist"
              : "Add to Blacklist"}
          </span>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const renderTree = (nodes: TreeNode[], depth: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile === node.path;
      const isHovered = hoveredNodePath === node.path;

      // Blacklisted files are not in the tree anymore, but keep the check just in case
      const isBlacklisted = checkIsBlacklisted(node.path);

      return (
        <div key={node.path}>
          <div
            style={{
              paddingLeft: `${depth * 12 + 8}px`,
              paddingRight: "8px",
              paddingTop: "4px",
              paddingBottom: "4px",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
              opacity: node.isImplicit ? 0.6 : isBlacklisted ? 1 : 0.6,
              borderLeft: isBlacklisted
                ? "2px solid var(--vscode-errorForeground)"
                : "none",
              backgroundColor: isSelected
                ? "var(--vscode-list-focusBackground)"
                : isHovered
                  ? "var(--list-hover-background)"
                  : isBlacklisted
                    ? "rgba(255, 0, 0, 0.05)"
                    : "transparent",
            }}
            onClick={() => {
              if (node.type === "folder") toggleFolder(node.path);
              else handleFileSelect(node);
            }}
            onMouseEnter={() => setHoveredNodePath(node.path)}
            onMouseLeave={() => {
              if (hoveredNodePath === node.path) setHoveredNodePath(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                filePath: node.path,
                fileName: node.name,
              });
            }}
          >
            <div
              style={{
                width: "18px",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {node.type === "folder" &&
                (isExpanded ? (
                  <ChevronDown
                    size={14}
                    style={{ opacity: node.isImplicit ? 0.5 : 1 }}
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    style={{ opacity: node.isImplicit ? 0.5 : 1 }}
                  />
                ))}
            </div>

            <div
              style={{
                marginRight: "6px",
                display: "flex",
                alignItems: "center",
                opacity: node.isImplicit ? 0.7 : 1,
              }}
            >
              {node.type === "folder" ? (
                <img
                  src={getFolderIconPath(isExpanded)}
                  alt="folder"
                  style={{
                    width: "16px",
                    height: "16px",
                    filter: node.isImplicit ? "grayscale(50%)" : "none",
                  }}
                />
              ) : (
                <img
                  src={getFileIconPath(node.name)}
                  alt="file"
                  style={{
                    width: "16px",
                    height: "16px",
                    opacity: node.isDeleted ? 0.6 : 1,
                  }}
                />
              )}
            </div>

            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div className="flex items-center gap-1 overflow-hidden">
                <span
                  className="truncate"
                  style={
                    {
                      fontStyle: node.isImplicit ? "italic" : "normal",
                      opacity: node.isDeleted ? 0.7 : 1,
                      color: isBlacklisted
                        ? "var(--vscode-errorForeground)"
                        : "inherit",
                      fontWeight: isBlacklisted ? 600 : 400,
                    } as React.CSSProperties
                  }
                >
                  {node.name}
                </span>
                {node.type === "file" && node.fileSize !== undefined && (
                  <span
                    style={{ fontSize: "10px", opacity: 0.5, fontWeight: 400 }}
                  >
                    ({(node.fileSize / 1024).toFixed(1)} KB)
                  </span>
                )}
                {node.isDeleted && (
                  <span style={{ fontSize: "10px", opacity: 0.7 }}>
                    (deleted)
                  </span>
                )}
              </div>

              {node.unconfirmed &&
                node.type === "file" &&
                (isHovered || isSelected) && (
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ext = node.name.split(".").pop() || "no_ext";
                        handleBinaryDecision(ext, true);
                      }}
                      className="p-1 hover:bg-[var(--vscode-gitDecoration-addedResourceForeground)] hover:bg-opacity-20 rounded text-[var(--vscode-gitDecoration-addedResourceForeground)]"
                      title="Keep Always"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ext = node.name.split(".").pop() || "no_ext";
                        handleBinaryDecision(ext, false);
                      }}
                      className="p-1 hover:bg-[var(--vscode-gitDecoration-deletedResourceForeground)] hover:bg-opacity-20 rounded text-[var(--vscode-gitDecoration-deletedResourceForeground)]"
                      title="Never Backup"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
            </div>

            {(isHovered || contextMenu?.filePath === node.path) &&
              !node.unconfirmed && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({
                      x: rect.left - 150, // Shift left so it opens inwards instead of overflowing right
                      y: rect.bottom,
                      filePath: node.path,
                      fileName: node.name,
                    });
                  }}
                  style={{ padding: "2px", opacity: 0.8 }}
                  title="Options"
                >
                  <EllipsisVertical size={14} />
                </div>
              )}
          </div>

          {node.type === "folder" && isExpanded && node.children && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const renderList = () => {
    // Collect all files from the Tree data to maintaining correct status
    const allFiles: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        if (n.type === "file") allFiles.push(n);
        if (n.children) traverse(n.children);
      });
    };
    traverse(treeData);

    return allFiles.map((node) => {
      const isSelected = selectedFile === node.path;
      const isHovered = hoveredNodePath === node.path;

      // Blacklisted files are not in the tree anymore, but keep the check just in case
      const isBlacklisted = checkIsBlacklisted(node.path);

      return (
        <div
          key={node.path}
          style={{
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            userSelect: "none",
            opacity: isBlacklisted ? 1 : node.isDeleted ? 0.6 : 1,
            borderLeft: isBlacklisted
              ? "2px solid var(--vscode-errorForeground)"
              : "none",
            backgroundColor: isSelected
              ? "var(--vscode-list-focusBackground)"
              : isHovered
                ? "var(--list-hover-background)"
                : isBlacklisted
                  ? "rgba(255, 0, 0, 0.05)"
                  : "transparent",
            gap: "8px",
          }}
          onClick={() => handleFileSelect(node)}
          onMouseEnter={() => setHoveredNodePath(node.path)}
          onMouseLeave={() => {
            if (hoveredNodePath === node.path) setHoveredNodePath(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              filePath: node.path,
              fileName: node.name,
            });
          }}
        >
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <img
              src={getFileIconPath(node.name)}
              alt="file"
              style={{
                width: "16px",
                height: "16px",
              }}
            />
          </div>

          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
            }}
          >
            <span
              style={
                {
                  color: isBlacklisted
                    ? "var(--vscode-errorForeground)"
                    : "inherit",
                  fontWeight: isBlacklisted ? 600 : 500,
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                } as React.CSSProperties
              }
            >
              {node.name}
            </span>
            <span
              className="truncate"
              style={{
                fontSize: "11px",
                color: "var(--secondary-text)",
                opacity: 0.7,
              }}
              title={node.path}
            >
              {node.path}
            </span>
          </div>

          {node.fileSize !== undefined && (
            <span
              style={{
                fontSize: "10px",
                opacity: 0.5,
                fontWeight: 400,
                flexShrink: 0,
              }}
            >
              {(node.fileSize / 1024).toFixed(1)} KB
            </span>
          )}
          {node.isDeleted && (
            <span style={{ fontSize: "10px", opacity: 0.7, flexShrink: 0 }}>
              (deleted)
            </span>
          )}

          {node.unconfirmed && (isHovered || isSelected) && (
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const ext = node.name.split(".").pop() || "no_ext";
                  handleBinaryDecision(ext, true);
                }}
                className="p-1 hover:bg-[var(--vscode-gitDecoration-addedResourceForeground)] hover:bg-opacity-20 rounded text-[var(--vscode-gitDecoration-addedResourceForeground)]"
                title="Keep Always"
              >
                <Check size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const ext = node.name.split(".").pop() || "no_ext";
                  handleBinaryDecision(ext, false);
                }}
                className="p-1 hover:bg-[var(--vscode-gitDecoration-deletedResourceForeground)] hover:bg-opacity-20 rounded text-[var(--vscode-gitDecoration-deletedResourceForeground)]"
                title="Never Backup"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {(isHovered || contextMenu?.filePath === node.path) &&
            !node.unconfirmed && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({
                    x: rect.left - 150, // Shift left so it opens inwards instead of overflowing right
                    y: rect.bottom,
                    filePath: node.path,
                    fileName: node.name,
                  });
                }}
                style={{ padding: "2px", opacity: 0.8, flexShrink: 0 }}
                title="Options"
              >
                <EllipsisVertical size={14} />
              </div>
            )}
        </div>
      );
    });
  };

  if (!isOpen) return null;

  // Filter selectedFileEvents to exclude blacklisted files just in case
  const selectedFileEvents =
    selectedFile && !checkIsBlacklisted(selectedFile)
      ? timeline
          .filter((e) => e.filePath === selectedFile)
          .sort((a, b) => b.timestamp - a.timestamp)
      : [];

  // Calculate total visible events
  const visibleEventsCount = timeline.filter(
    (e) => !checkIsBlacklisted(e.filePath),
  ).length;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "60%",
        backgroundColor: "var(--vscode-editor-background)",
        borderTop: "1px solid var(--vscode-panel-border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
        boxShadow: "0 -2px 8px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--vscode-editor-background)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {selectedFile ? (
            <div
              onClick={() => setSelectedFile(null)}
              style={{
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                color: "var(--vscode-breadcrumb-foreground)",
                background: "transparent",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--vscode-foreground)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color =
                  "var(--vscode-breadcrumb-foreground)")
              }
              title="Back to file list"
            >
              <ChevronLeft size={16} />
            </div>
          ) : (
            <div style={{ color: "var(--accent-color)" }}>
              <DatabaseBackupIcon />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {selectedFile && (
                <img
                  src={getFileIconPath(selectedFile.split("/").pop() || "")}
                  alt="file"
                  style={{ width: "16px", height: "16px" }}
                />
              )}
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                {selectedFile
                  ? selectedFile.split("/").pop()
                  : "Code Backup History"}
              </span>
            </div>
          </div>
          {!selectedFile && (
            <span
              style={{
                fontSize: "11px",
                color: "var(--secondary-text)",
                backgroundColor: "var(--badge-bg)",
                padding: "2px 8px",
                borderRadius: "10px",
              }}
            >
              {visibleEventsCount} events
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {!selectedFile && (
            <div
              onClick={() => setIsListView(!isListView)}
              style={{
                cursor: "pointer",
                padding: "2px 4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                color: "var(--secondary-text)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              title={isListView ? "Switch to Tree View" : "Switch to List View"}
            >
              {isListView ? <Network size={14} /> : <List size={14} />}
            </div>
          )}
          <div
            onClick={onClose}
            style={{
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <X size={16} />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "var(--vscode-editor-background)",
        }}
      >
        {/* Full width panel that switches content based on selection */}
        <div
          style={{
            width: "100%",
            overflowY: "auto",
            padding: selectedFile ? "0" : "4px 0",
            display: "flex",
            flexDirection: "column",
            gap: selectedFile ? "0" : "0",
          }}
          className="custom-scrollbar"
        >
          {!selectedFile ? (
            treeData.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  color: "var(--secondary-text)",
                  textAlign: "center",
                  fontSize: "13px",
                  opacity: 0.6,
                }}
              >
                No backups found in this conversation
              </div>
            ) : isListView ? (
              renderList()
            ) : (
              renderTree(treeData)
            )
          ) : // Premium History Cards View
          selectedFileEvents.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {selectedFileEvents.map((event, index) => {
                const isActive = selectedEvent?.timestamp === event.timestamp;
                const eventColor = getEventColor(event.eventType);

                return (
                  <div
                    key={index}
                    onClick={() => handleEventClick(event)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center", // Vertically center items
                      gap: "12px",
                      position: "relative",
                      overflow: "hidden",
                      transition: "all 0.2s ease-in-out",
                      background: isActive
                        ? `linear-gradient(to right, color-mix(in srgb, ${eventColor}, transparent 90%), transparent)`
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = `linear-gradient(to right, color-mix(in srgb, ${eventColor}, transparent 95%), transparent)`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {/* Active Indicator Bar (Sidebar Style) */}
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "4px",
                          height: "24px",
                          backgroundColor: eventColor,
                          borderRadius: "8px 0 0 8px",
                        }}
                      />
                    )}

                    {/* Badge Icon (Left, Centered) */}
                    <div
                      style={{
                        color: eventColor,
                        display: "flex",
                        alignItems: "center",
                        padding: "0",
                      }}
                    >
                      {getEventIcon(event.eventType)}
                    </div>

                    {/* Content Column (Title + Metadata) */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        flex: 1,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: isActive ? 600 : 500,
                          color: isActive
                            ? "var(--vscode-foreground)"
                            : "var(--secondary-text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {event.eventType === "initial_state"
                          ? "Original"
                          : event.eventType === "file_added"
                            ? "Create"
                            : event.eventType === "file_modified"
                              ? "Modified"
                              : event.eventType
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>

                      {/* Metadata Row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ fontSize: "11px", opacity: 0.5 }}>
                          {formatTimestamp(event.timestamp)}
                        </span>

                        {event.diff && (
                          <div
                            style={{
                              fontSize: "10px",
                              display: "flex",
                              gap: "6px",
                              fontWeight: 600,
                              opacity: 0.8,
                            }}
                          >
                            <span
                              style={{
                                color:
                                  "var(--vscode-gitDecoration-addedResourceForeground)",
                              }}
                            >
                              +{event.diff.additions}
                            </span>
                            <span
                              style={{
                                color:
                                  "var(--vscode-gitDecoration-deletedResourceForeground)",
                              }}
                            >
                              -{event.diff.deletions}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons (Right, Centered) */}
                    <div
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        gap: "4px",
                      }}
                    >
                      {event.snapshotPath &&
                        event.fileExists &&
                        event.eventType !== "file_added" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDiffWithCurrent(event);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: "5px",
                              cursor: "pointer",
                              color: "var(--vscode-descriptionForeground)",
                              display: "flex",
                              alignItems: "center",
                              borderRadius: "4px",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--vscode-charts-orange)1a"; // 10% opacity
                              e.currentTarget.style.color =
                                "var(--vscode-charts-orange)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                              e.currentTarget.style.color =
                                "var(--vscode-descriptionForeground)";
                            }}
                            title="Compare with workspace file"
                          >
                            <FileDiffIcon size={16} />
                          </button>
                        )}
                      {event.snapshotPath &&
                        event.eventType !== "file_added" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevert(event);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: "5px",
                              cursor: "pointer",
                              color: "var(--vscode-descriptionForeground)",
                              display: "flex",
                              alignItems: "center",
                              borderRadius: "4px",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--vscode-textLink-foreground)1a"; // 10% opacity
                              e.currentTarget.style.color =
                                "var(--vscode-textLink-foreground)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                              e.currentTarget.style.color =
                                "var(--vscode-descriptionForeground)";
                            }}
                            title={
                              event.eventType === "file_deleted"
                                ? "Restore File"
                                : "Revert to this version"
                            }
                          >
                            <Undo2 size={16} />
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: "40px 16px",
                textAlign: "center",
                color: "var(--secondary-text)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <History size={32} style={{ opacity: 0.2 }} />
              <span style={{ fontSize: "13px" }}>
                No history found for this file
              </span>
              <button
                onClick={() => setSelectedFile(null)}
                style={{
                  backgroundColor: "var(--vscode-button-background)",
                  color: "var(--vscode-button-foreground)",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Back to workspace tree
              </button>
            </div>
          )}
        </div>
      </div>
      {renderContextMenu()}

      <LargeBinaryBackupDrawer
        isOpen={largeFilesPrompt.isOpen}
        files={largeFilesPrompt.files}
        onClose={() => setLargeFilesPrompt({ isOpen: false, files: [] })}
        onDecision={handleBinaryDecision}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: var(--scrollbar-thumb);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: var(--scrollbar-thumb-hover);
        }
      `}</style>
    </div>
  );
};

export default BackupDrawer;
