import React, { useState } from 'react';
import FileIcon from "@/icons/FileIcon";
import './TreeBlock.css';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  size?: number;
  lines?: number;
}

interface TreeBlockProps {
  files: FileNode[];
  onFileClick?: (path: string) => void;
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
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    }
  };

  const handleClick = () => {
    if (node.type === 'file' && onFileClick) {
      onFileClick(node.path);
    }
  };

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="tree-node">
      <div
        className={`tree-node-content ${node.type === 'file' ? 'clickable' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
      >
        {node.type === 'folder' && hasChildren && (
          <span
            className={`codicon codicon-chevron-${isExpanded ? 'down' : 'right'} tree-chevron`}
            onClick={handleToggle}
          />
        )}
        {node.type === 'folder' && !hasChildren && (
          <span className="tree-chevron-placeholder" />
        )}
        <FileIcon
          path={node.path}
          isFolder={node.type === 'folder'}
          style={{ width: "14px", height: "14px", marginRight: "6px" }}
        />
        <span className="tree-node-name">{node.name}</span>
        {node.type === 'file' && node.lines !== undefined && (
          <span className="tree-node-meta">{node.lines} lines</span>
        )}
      </div>
      {node.type === 'folder' && isExpanded && hasChildren && (
        <div className="tree-node-children">
          {node.children!.map((child, index) => (
            <TreeNode
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeBlock: React.FC<TreeBlockProps> = ({ files, onFileClick }) => {
  return (
    <div className="tree-block">
      {files.map((file, index) => (
        <TreeNode
          key={`${file.path}-${index}`}
          node={file}
          level={0}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
};
