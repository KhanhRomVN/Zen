import React, { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, ListFilter, Info } from "lucide-react";
import { getFileIconPath, getFolderIconPath } from "../../utils/fileIconMapper";
import { useBlacklistManager, TreeNode } from "../../hooks/useBlacklistManager";

interface BlacklistManagerProps {
  className?: string;
}

const BlacklistManager: React.FC<BlacklistManagerProps> = ({ className }) => {
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

  const toggleExpanded = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isBlacklisted = checkIsBlacklisted(node.path);
    const isExplicitNegation = blacklist.includes("!" + node.path);
    const isExplicitBlacklisted = blacklist.includes(node.path);
    const isExpanded = expandedFolders.has(node.path);
    const isHovered = hoveredPath === node.path;
    const isDirectory = node.type === "directory";

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
            backgroundColor: isHovered
              ? "var(--vscode-list-hoverBackground)"
              : "transparent",
            opacity: isBlacklisted ? 1 : 0.4,
            filter: isBlacklisted ? "none" : "grayscale(0.5)",
          }}
          onMouseEnter={() => setHoveredPath(node.path)}
          onMouseLeave={() => setHoveredPath(null)}
          onClick={() => isDirectory && toggleExpanded(node.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            toggleBlacklist(node.path, isBlacklisted);
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
              color: isBlacklisted
                ? "var(--vscode-errorForeground)"
                : "var(--vscode-foreground)",
              fontWeight: isBlacklisted ? 600 : 400,
            }}
          >
            {node.name}
          </span>
          {isBlacklisted && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                backgroundColor: isExplicitBlacklisted
                  ? "rgba(255,0,0,0.1)"
                  : "rgba(255,255,255,0.05)",
                color: isExplicitBlacklisted
                  ? "var(--vscode-errorForeground)"
                  : "var(--vscode-descriptionForeground)",
                padding: "0 4px",
                borderRadius: "2px",
                border: "1px solid",
                borderColor: isExplicitBlacklisted
                  ? "var(--vscode-errorForeground)"
                  : "transparent",
              }}
            >
              {isExplicitBlacklisted ? "Blacklisted" : "Banned"}
            </span>
          )}
          {isExplicitNegation && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                backgroundColor: "rgba(0,255,0,0.1)",
                color: "var(--vscode-charts-green)",
                padding: "0 4px",
                borderRadius: "2px",
                border: "1px solid var(--vscode-charts-green)",
              }}
            >
              Excluded
            </span>
          )}
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
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
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
          <span
            style={{
              fontSize: "10px",
              backgroundColor: "var(--vscode-badge-background)",
              color: "var(--vscode-badge-foreground)",
              padding: "2px 8px",
              borderRadius: "10px",
              fontWeight: 500,
            }}
          >
            {blacklist.length} blacklisted
          </span>
          <button
            onClick={fetchData}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--vscode-descriptionForeground)",
              display: "flex",
              padding: "2px",
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
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
            </svg>
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 8px",
          backgroundColor: "rgba(0,0,0,0.2)",
          borderRadius: "4px",
          borderLeft: "3px solid var(--vscode-infoForeground)",
        }}
      >
        <Info size={14} style={{ color: "var(--vscode-infoForeground)" }} />
        <span
          style={{
            fontSize: "11px",
            color: "var(--vscode-descriptionForeground)",
          }}
        >
          Right-click on File/Folder to toggle Blacklist.
        </span>
      </div>
      <div
        style={{
          border: "1px solid var(--vscode-settings-textInputBorder)",
          borderRadius: "4px",
          backgroundColor: "var(--vscode-settings-textInputBackground)",
          minHeight: "300px",
          maxHeight: "500px",
          overflow: "auto",
          padding: "4px",
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
    </div>
  );
};

export default BlacklistManager;
