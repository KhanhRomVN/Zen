import React, { useState, useCallback, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  ListFilter,
  Info,
  Plus,
  Trash2,
  Filter,
  ChevronsUpDown,
  ChevronsDownUp,
} from "lucide-react";
import { getFileIconPath, getFolderIconPath } from "../../utils/fileIconMapper";
import { useBlacklistManager, TreeNode } from "../../hooks/useBlacklistManager";

interface BlacklistManagerProps {
  className?: string;
  onClose?: () => void;
}

const BlacklistManager: React.FC<BlacklistManagerProps> = ({
  className,
  onClose,
}) => {
  const {
    blacklist,
    treeData,
    isLoading,
    fetchData,
    toggleBlacklist,
    checkIsBlacklisted,
  } = useBlacklistManager();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [hideNonBlacklisted, setHideNonBlacklisted] = useState(false);

  const blacklistCounts = React.useMemo(() => {
    let files = 0;
    let folders = 0;

    // Create a map of known path types from the tree
    const knownTypes = new Map<string, "file" | "directory">();
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        knownTypes.set(node.path, node.type);
        if (node.children) traverse(node.children);
      }
    };
    if (treeData) traverse([treeData]);

    for (const item of blacklist) {
      if (item.startsWith("!")) continue;

      const type = knownTypes.get(item);
      if (type === "directory") {
        folders++;
      } else if (type === "file") {
        files++;
      } else {
        // Fallback: guess by extension
        if (item.includes(".") && !item.startsWith(".")) {
          files++;
        } else {
          folders++; // Default guess for extensionless paths
        }
      }
    }

    return { files, folders };
  }, [blacklist, treeData]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    name: string;
    isExplicitBlacklisted: boolean;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!treeData) return;
    const allPaths = new Set<string>();
    const traverse = (node: TreeNode) => {
      if (node.type === "directory") {
        allPaths.add(node.path);
        if (node.children) {
          node.children.forEach(traverse);
        }
      }
    };
    traverse(treeData);
    setExpandedFolders(allPaths);
  }, [treeData]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  const checkHasBlacklistedDescendant = useCallback(
    (node: TreeNode): boolean => {
      if (!node.children) return false;
      return node.children.some(
        (child) =>
          checkIsBlacklisted(child.path) ||
          checkHasBlacklistedDescendant(child),
      );
    },
    [checkIsBlacklisted],
  );

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isBlacklisted = checkIsBlacklisted(node.path);
    const isExplicitNegation = blacklist.includes("!" + node.path);
    const isExplicitBlacklisted = blacklist.includes(node.path);
    const isImplicitBlacklisted = isBlacklisted && !isExplicitBlacklisted;
    const isExpanded = expandedFolders.has(node.path);
    const isHovered = hoveredPath === node.path;
    const isDirectory = node.type === "directory";
    const hasBlacklistedDescendant = isDirectory
      ? checkHasBlacklistedDescendant(node)
      : false;

    // Filter logic
    if (hideNonBlacklisted && !isBlacklisted && !hasBlacklistedDescendant) {
      return null;
    }

    let bgColor = "transparent";
    if (isHovered) {
      bgColor = "var(--vscode-list-hoverBackground)";
    }

    let textColor = "var(--vscode-foreground)";
    if (isDirectory && isExplicitBlacklisted) {
      textColor = "var(--vscode-errorForeground)";
    } else if (isImplicitBlacklisted) {
      textColor =
        "color-mix(in srgb, var(--vscode-errorForeground) 45%, var(--vscode-descriptionForeground))";
    } else if (!isDirectory && isExplicitBlacklisted) {
      textColor = "var(--vscode-charts-purple)";
    }

    return (
      <div key={node.path}>
        <div
          style={{
            paddingLeft: `${depth * 16 + 8}px`,
            paddingRight: "8px",
            paddingTop: "4px",
            paddingBottom: "4px",
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            borderRadius: "4px",
            transition: "all 0.2s",
            backgroundColor: bgColor,
            opacity: isBlacklisted ? 1 : 0.6,
            filter: "none",
          }}
          onMouseEnter={() => setHoveredPath(node.path)}
          onMouseLeave={() => setHoveredPath(null)}
          onClick={() => isDirectory && toggleExpanded(node.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              path: node.path,
              name: node.name,
              isExplicitBlacklisted: isExplicitBlacklisted,
            });
          }}
          title={
            isBlacklisted
              ? `Blacklisted. Right-click to remove/exclude.`
              : "Normal. Right-click to blacklist."
          }
        >
          <div
            style={{
              width: "18px",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {isDirectory &&
              (isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              ))}
          </div>
          <div
            style={{
              marginRight: "6px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isDirectory ? (
              <img
                src={getFolderIconPath(isExpanded)}
                alt="folder"
                style={{ width: "16px", height: "16px" }}
              />
            ) : (
              <img
                src={getFileIconPath(node.name)}
                alt="file"
                style={{ width: "16px", height: "16px" }}
              />
            )}
          </div>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "13px",
              color: textColor,
              fontWeight: 400,
            }}
          >
            {node.name}
          </span>
        </div>
        {isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
      }}
      className={className}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 600,
            margin: 0,
            color: "var(--vscode-settings-headerForeground)",
          }}
        >
          Backup Blacklist
        </h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "10px",
                backgroundColor:
                  "color-mix(in srgb, var(--vscode-charts-purple) 15%, transparent)",
                color: "var(--vscode-charts-purple)",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              {blacklistCounts.files} files
            </span>
            <span
              style={{
                fontSize: "10px",
                backgroundColor:
                  "color-mix(in srgb, var(--vscode-errorForeground) 15%, transparent)",
                color: "var(--vscode-errorForeground)",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              {blacklistCounts.folders} folders
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "var(--vscode-descriptionForeground)",
                fontWeight: 500,
                marginLeft: "2px",
              }}
            >
              in blacklist
            </span>
          </div>
          <button
            onClick={() => setHideNonBlacklisted(!hideNonBlacklisted)}
            style={{
              border: "none",
              background: hideNonBlacklisted
                ? "var(--vscode-list-activeSelectionBackground)"
                : "transparent",
              cursor: "pointer",
              color: hideNonBlacklisted
                ? "var(--vscode-list-activeSelectionForeground)"
                : "var(--vscode-descriptionForeground)",
              display: "flex",
              padding: "4px",
              borderRadius: "4px",
              marginLeft: "4px",
            }}
            title={
              hideNonBlacklisted ? "Show All Files" : "Show Only Blacklisted"
            }
          >
            <Filter size={14} />
          </button>
          <button
            onClick={expandAll}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--vscode-descriptionForeground)",
              display: "flex",
              padding: "4px",
              borderRadius: "4px",
            }}
            title="Expand All"
          >
            <ChevronsUpDown size={14} />
          </button>
          <button
            onClick={collapseAll}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--vscode-descriptionForeground)",
              display: "flex",
              padding: "4px",
              borderRadius: "4px",
            }}
            title="Collapse All"
          >
            <ChevronsDownUp size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--vscode-descriptionForeground)",
                display: "flex",
                padding: "2px",
              }}
              title="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          flex: 1, // Take up remaining space
          minHeight: "0", // Important for flex scrolling
          overflow: "auto",
          padding: "4px 0",
        }}
      >
        {isLoading && !treeData ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontSize: "12px",
              color: "var(--vscode-descriptionForeground)",
              padding: "40px 0",
            }}
          >
            Loading project structure...
          </div>
        ) : treeData ? (
          renderNode(treeData)
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontSize: "12px",
              color: "var(--vscode-descriptionForeground)",
              padding: "40px 16px",
              gap: "8px",
              textAlign: "center",
            }}
          >
            <ListFilter size={24} style={{ opacity: 0.2 }} />
            <span>Could not load project structure</span>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: Math.min(contextMenu.x, window.innerWidth - 180),
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={contextMenu.name}
          >
            {contextMenu.name}
          </div>
          <div
            className="context-menu-item"
            onClick={() => {
              toggleBlacklist(
                contextMenu.path,
                contextMenu.isExplicitBlacklisted,
              );
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
            {contextMenu.isExplicitBlacklisted ? (
              <>
                <Trash2 size={14} />
                <span>Remove from Blacklist</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Add to Blacklist</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlacklistManager;
