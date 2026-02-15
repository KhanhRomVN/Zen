import React, { useState, useMemo } from "react";
import FileIcon from "../../../common/FileIcon";
import styled from "styled-components";

interface ProjectStructureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: { path: string; type: "file" | "folder"; size?: number }[];
  folders: { path: string; type: "file" | "folder"; size?: number }[];
  blacklist: string[];
  onRefresh: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children: TreeNode[];
  isOpen?: boolean;
  size: number;
}

const SizeLabel = styled.span<{ $size: number }>`
  margin-left: auto;
  font-size: 11px;
  font-family: monospace;
  color: ${(props) =>
    getSizeColor(props.$size, 1024 * 1024 * 10)}; /* Max ref 10MB */
  padding-right: 8px;
`;

// Helper to determine color based on size
const getSizeColor = (size: number, max: number) => {
  // Simple logic: < 10KB: standard, > 1MB: bright
  if (size > 1024 * 1024) return "var(--vscode-editorError-foreground)";
  if (size > 100 * 1024) return "var(--vscode-editorWarning-foreground)";
  return "var(--vscode-descriptionForeground)";
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const ProjectStructureDrawer: React.FC<ProjectStructureDrawerProps> = ({
  isOpen,
  onClose,
  files,
  folders,
  blacklist,
  onRefresh,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const blacklistSet = useMemo(() => new Set(blacklist), [blacklist]);

  // Helper function to check if a path matches any blacklist pattern
  const isPathBlacklisted = (path: string): boolean => {
    // Check exact match
    if (blacklistSet.has(path)) return true;

    // Check if any blacklist pattern matches this path
    for (const pattern of blacklist) {
      // Exact match
      if (path === pattern) return true;
      // Match if path ends with /pattern (for nested folders)
      if (path.endsWith(`/${pattern}`)) return true;
      // Match if path starts with pattern/ (for files/folders inside)
      if (path.startsWith(`${pattern}/`)) return true;
    }
    return false;
  };

  // Convert flat list to tree structure
  const treeData = useMemo(() => {
    // Helper to calculate folder size
    const calculateFolderSize = (node: TreeNode): number => {
      let size = 0;
      if (node.type === "file") {
        size = node.size;
      } else {
        node.children.forEach((child) => {
          size += calculateFolderSize(child);
        });
        node.size = size;
      }
      return size;
    };

    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // Combine files and folders
    const allItems = [...folders, ...files].sort((a, b) => {
      // Folders first
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      // Then alphabetical
      return a.path.localeCompare(b.path);
    });

    allItems.forEach((item) => {
      const parts = item.path.split("/");
      let parentPath = "";

      parts.forEach((part, index) => {
        const currentPath = parentPath ? `${parentPath}/${part}` : part;
        const isLast = index === parts.length - 1;
        const type = isLast ? item.type : "folder";
        // Use provided size for files, 0 for folders initially
        const size = isLast && item.size ? item.size : 0;

        let node = nodeMap.get(currentPath);
        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: type,
            children: [],
            size: size,
          };
          nodeMap.set(currentPath, node);

          if (parentPath) {
            const parent = nodeMap.get(parentPath);
            if (parent) {
              parent.children.push(node);
              // Sort children immediately
              parent.children.sort((a, b) => {
                if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                return a.name.localeCompare(b.name);
              });
            }
          } else {
            rootNodes.push(node);
          }
        } else if (isLast && type === "file") {
          // Update size if the node was created as a folder placeholder but is actually a file
          node.size = size;
        }
        parentPath = currentPath;
      });
    });

    // Calculate folder sizes
    rootNodes.forEach(calculateFolderSize);

    // Final sort of root
    return rootNodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [files, folders]);

  // Calculate total project size (excluding blacklisted items)
  const totalSize = useMemo(() => {
    return treeData.reduce((sum, node) => {
      // Skip blacklisted nodes
      if (isPathBlacklisted(node.path)) return sum;
      return sum + node.size;
    }, 0);
  }, [treeData, blacklist]);

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const renderTree = (
    nodes: TreeNode[],
    depth: number = 0,
    parentBlacklisted: boolean = false
  ) => {
    return nodes.map((node) => {
      const isExpanded = expandedPaths.has(node.path);
      const isFolder = node.type === "folder";
      const paddingLeft = depth * 16 + 16;
      const isExplicitlyBlacklisted = isPathBlacklisted(node.path);
      const isBlacklisted = parentBlacklisted || isExplicitlyBlacklisted;

      return (
        <div key={node.path}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: `4px 8px 4px ${paddingLeft}px`,
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--primary-text)",
              transition: "background-color 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onClick={() => isFolder && toggleExpand(node.path)}
          >
            {/* Chevron for folder */}
            <div
              style={{
                width: "16px",
                display: "flex",
                justifyContent: "center",
                marginRight: "4px",
              }}
            >
              {isFolder && (
                <span
                  style={{
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.1s",
                    fontSize: "10px",
                    color: "var(--secondary-text)",
                  }}
                >
                  ▶
                </span>
              )}
            </div>

            {/* Icon */}
            <FileIcon
              path={node.path}
              isFolder={isFolder}
              isOpen={isExpanded}
              style={{ width: "16px", height: "16px", marginRight: "6px" }}
            />

            {/* Name */}
            <span
              style={{
                opacity: node.name.startsWith(".") ? 0.6 : 1,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: isBlacklisted ? "var(--secondary-text)" : "inherit",
                textDecoration: isBlacklisted ? "line-through" : "none",
              }}
            >
              {node.name}
            </span>

            {/* Size Label */}
            <SizeLabel $size={node.size}>{formatSize(node.size)}</SizeLabel>
          </div>

          {/* Children */}
          {isFolder && isExpanded && (
            <div>
              {node.children.length > 0 ? (
                renderTree(node.children, depth + 1, isBlacklisted)
              ) : (
                <div
                  style={{
                    paddingLeft: `${paddingLeft + 20}px`,
                    fontSize: "12px",
                    color: "var(--secondary-text)",
                    paddingTop: "4px",
                    paddingBottom: "4px",
                  }}
                >
                  (empty)
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        data-project-structure-drawer="true"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "var(--primary-bg)",
          borderTop: "1px solid var(--border-color)",
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
          padding: "0",
          zIndex: 1001,
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
          transform: "translateY(0)",
          animation: "slideUp 0.3s ease-out",
          height: "60vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontWeight: 600, fontSize: "15px" }}>
              Project Structure
            </div>
            <div
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "10px",
                backgroundColor: "var(--button-secondary)",
                color: "var(--secondary-text)",
                fontFamily: "monospace",
              }}
            >
              {formatSize(totalSize)}
            </div>
            <button
              onClick={onRefresh}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "var(--secondary-text)",
                display: "flex",
                alignItems: "center",
              }}
              title="Refresh"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 1 20.49 15" />
              </svg>
            </button>
          </div>

          <div
            style={{
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={onClose}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>

        {/* content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {files.length === 0 && folders.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--secondary-text)",
              }}
            >
              No files found. Try refreshing.
            </div>
          ) : (
            renderTree(treeData)
          )}
        </div>
      </div>

      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1000,
        }}
        onClick={onClose}
      />
      <style>
        {`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}
      </style>
    </>
  );
};

export default ProjectStructureDrawer;
