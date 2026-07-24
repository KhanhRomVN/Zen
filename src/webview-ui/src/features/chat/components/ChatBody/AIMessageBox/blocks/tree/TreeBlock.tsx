import React, { useState } from "react";
import { getFileIconPath, getFolderIconPath } from "@/utils/fileIconMapper";
import ErrorBlock from "../error/ErrorBlock";
import "./TreeBlock.css";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
  size?: number;
  lines?: number;
}

interface TreeBlockProps {
  files: FileNode[];
  onFileClick?: (path: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TreeNode: React.FC<{
  node: FileNode;
  level: number;
  onFileClick?: (path: string) => void;
}> = ({ node, level, onFileClick }) => {
  // Expand all folders by default for find_files to show all results
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === "folder") {
      setIsExpanded(!isExpanded);
    }
  };

  const handleClick = () => {
    if (node.type === "file" && onFileClick) {
      onFileClick(node.path);
    }
  };

  const hasChildren = node.children && node.children.length > 0;
  const iconPath =
    node.type === "folder"
      ? getFolderIconPath(node.name, isExpanded)
      : getFileIconPath(node.path);

  return (
    <div className="tree-node">
      <div
        className={`tree-node-content ${node.type === "file" ? "clickable" : ""}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
      >
        {node.type === "folder" && hasChildren && (
          <span
            className={`codicon codicon-chevron-${isExpanded ? "down" : "right"} tree-chevron`}
            onClick={handleToggle}
          />
        )}
        {node.type === "folder" && !hasChildren && (
          <span className="tree-chevron-placeholder" />
        )}
        {node.type === "file" && <span className="tree-chevron-placeholder" />}
        <img
          src={iconPath}
          alt={`${node.type} icon`}
          style={{
            width: "14px",
            height: "14px",
            marginRight: "6px",
            flexShrink: 0,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const fallback = document.createElement("span");
              fallback.className = `codicon codicon-${node.type === "folder" ? "folder" : "file"}`;
              fallback.style.cssText =
                "font-size: 12px; color: var(--vscode-descriptionForeground); opacity: 0.7; margin-right: 6px; flex-shrink: 0;";
              parent.insertBefore(fallback, e.currentTarget);
            }
          }}
        />
        <span className="tree-node-name">{node.name}</span>
        {node.type === "file" && node.size !== undefined && (
          <span className="tree-node-meta">{formatFileSize(node.size)}</span>
        )}
      </div>
      {node.type === "folder" && isExpanded && hasChildren && (
        <div className="tree-node-children">
          {node.children!.map((child, index) => {
            return (
              <TreeNode
                key={`${child.path}-${index}`}
                node={child}
                level={level + 1}
                onFileClick={onFileClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const TreeBlock: React.FC<TreeBlockProps> = ({ files, onFileClick }) => {
  // Debug logging with alert for visibility
  React.useEffect(() => {
    const debugInfo = {
      filesCount: files?.length || 0,
      filesType: Array.isArray(files) ? "array" : typeof files,
      firstFile: files?.[0]
        ? {
            name: files[0].name,
            type: files[0].type,
            path: files[0].path,
            hasChildren: !!files[0].children,
            childrenCount: files[0].children?.length || 0,
          }
        : "no files",
      rawData: files,
    };
  }, [files]);

  // Validate data structure
  if (!Array.isArray(files)) {
    console.error("[TreeBlock] Invalid files data - not an array:", files);
    return <ErrorBlock content="Invalid tree data format (not array)" compact={true} maxHeight="300px" />;
  }

  if (files.length === 0) {
    return (
      <div style={{ padding: "8px", opacity: 0.6 }}>No files to display</div>
    );
  }

  return (
    <div
      style={{
        marginTop: "4px",
        backgroundColor:
          "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div className="tree-block">
        {files.map((file, index) => {
          return (
            <TreeNode
              key={`${file.path}-${index}`}
              node={file}
              level={0}
              onFileClick={onFileClick}
            />
          );
        })}
      </div>
    </div>
  );
};