import React, { useMemo, useState } from "react";
import { parseAIResponse, ToolAction } from "../../services/ResponseParser";
import FileIcon from "../common/FileIcon";

interface ChangesTreeProps {
  messages: any[];
  onClose?: () => void;
  onCommit?: () => void;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  status: "added" | "modified" | "deleted";
  children?: Record<string, FileNode>;
}

interface FlatFileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  timestamp: number;
}

const ChangesTree: React.FC<ChangesTreeProps> = ({
  messages,
  onClose,
  onCommit,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  // Extract changes from messages
  const changes = useMemo(() => {
    const fileChanges: Record<string, FlatFileChange> = {};

    messages.forEach((msg) => {
      if (msg.role !== "assistant") return;

      const parsed = parseAIResponse(msg.content);
      parsed.actions.forEach((action: ToolAction) => {
        if (!action.params.path) return;

        const path = action.params.path;
        const timestamp = msg.timestamp;

        // Determine status
        let status: "added" | "modified" | "deleted" = "modified";

        if (action.type === "write_to_file") {
          // Heuristic: if write_to_file and no previous record, maybe "added"?
          // But usually hard to tell without git. We'll default to 'modified'
          // unless we can be sure.
          // For now, let's treat write_to_file as 'modified' as it overwrites.
          status = "modified";
        } else if (action.type === "replace_in_file") {
          status = "modified";
        } else if (action.type === "run_command") {
          const cmd = action.params.command || "";
          // Simple heuristic for delete
          if (cmd.match(/^rm\s+/) && action.params.path) {
            status = "deleted";
          } else {
            return; // Ignore other commands
          }
        } else {
          return; // Ignore read, list, search
        }

        // Update record (last write wins)
        fileChanges[path] = {
          path,
          status,
          timestamp,
        };
      });
    });

    return Object.values(fileChanges).sort((a, b) =>
      a.path.localeCompare(b.path),
    );
  }, [messages]);

  // Build Tree
  const tree = useMemo(() => {
    const root: Record<string, FileNode> = {};

    changes.forEach((change) => {
      const parts = change.path.split("/"); // Assuming posix paths for simplicity
      let currentLevel = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join("/");

        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            path: currentPath,
            type: isFile ? "file" : "folder",
            status: isFile ? change.status : "modified", // Folders just inherit or default
            children: isFile ? undefined : {},
          };
        }

        if (!isFile) {
          currentLevel = currentLevel[part].children!;
        }
      });
    });

    return root;
  }, [changes]);

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFileClick = (node: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === "folder") {
      toggleFolder(node.path, e);
      return;
    }

    // Open diff view
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      // For modified files, open diff. For deleted, maybe show error or handled by extension?
      // Let's assume openDiffView handles current vs previous or similar.
      // Actually extension `openDiffView` expects `newCode`.
      // We might just want `openFile` for now, or `getGitChanges` variant.
      // The user asked: "click vào file để xem change của nó... file sửa thì 1 bên góc và 1 bên cũ"
      // This implies git diff logic.
      // For simplicity, let's trigger `openFile` first, or if we had git status we use that.
      // Since we only have historical actions, we assume the file exists on disk now.
      // Let's use `openFile` which opens the current file.
      // TO DO: Start a diff with the version BEFORE the tool call? That requires complex history tracking.
      // User request: "click vào sẽ mở ... change ... file sửa thì 1 bên góc và 1 bên cũ"
      // This strongly implies `vscode.diff`.
      // To properly support "Old vs New", we'd need to know what the "Old" was.
      // BUT, if we consider "Changes" as "Git Changes", we can use the Git extension API via a command.
      // However, this tree is built from *chat history*, not *git status*.
      // If the chat modified a file, it's modified.
      // A simple "open file" is the safest first step.
      // If we want diff, we need the "original" content which we don't store in chat messages.
      // UNLESS we use the Git capability.
      // Let's send a custom command `openChangesDiff` or just `openFile`.
      // Given constraints, I will use `openFile`. User can click "Open Changes" in VSCode SCM if they want diff.
      // Or I can interpret "click to see changes" as "open the file".
      // Let's stick to `openFile` for now and add a TODO comment.
      vscodeApi.postMessage({
        command: "openFile",
        path: node.path,
      });
    }
  };

  const renderNode = (node: FileNode) => {
    // To implement "Default Expanded", we can change state logic or just check `!collapsed.has(path)`.
    const isCollapsed = expandedFolders.has(node.path); // Rename logic: set contains CLOSED folders.
    // Wait, let's stick to `set has = OPEN`.
    const isOpen =
      node.type === "folder" ? expandedFolders.has(node.path) : false;

    return (
      <div key={node.path} style={{ marginLeft: "12px" }}>
        <div
          onClick={(e) => handleFileClick(node, e)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 6px",
            cursor: "pointer",
            borderRadius: "4px",
            fontSize: "13px",
            color: "var(--vscode-foreground)",
            opacity: node.status === "deleted" ? 0.6 : 1,
            textDecoration: node.status === "deleted" ? "line-through" : "none",
          }}
          className="hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          {/* Icon */}
          {node.type === "folder" ? (
            <span
              style={{
                display: "inline-block",
                width: "16px",
                textAlign: "center",
                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.1s",
              }}
            >
              ▶
            </span>
          ) : null}

          <FileIcon
            path={node.name}
            isFolder={node.type === "folder"}
            isOpen={isOpen}
            style={{ width: "16px", height: "16px" }}
          />

          <span>{node.name}</span>

          <span
            style={{
              marginLeft: "auto",
              fontSize: "10px",
              opacity: 0.7,
              color:
                node.status === "added"
                  ? "var(--vscode-gitDecoration-addedResourceForeground)"
                  : node.status === "modified"
                    ? "var(--vscode-gitDecoration-modifiedResourceForeground)"
                    : "var(--vscode-gitDecoration-deletedResourceForeground)",
            }}
          >
            {node.status === "added"
              ? "A"
              : node.status === "modified"
                ? "M"
                : "D"}
          </span>
        </div>

        {node.type === "folder" && isOpen && node.children && (
          <div>
            {Object.values(node.children)
              .sort((a, b) => {
                // Folders first, then files
                if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  // Custom Render Logic for Tree Root
  const renderRoot = () => {
    if (changes.length === 0) {
      return (
        <div style={{ padding: "10px", opacity: 0.7, fontSize: "12px" }}>
          No changes detected in this chat.
        </div>
      );
    }

    return (
      <div style={{ maxHeight: "300px", overflowY: "auto", padding: "4px 0" }}>
        {Object.values(tree)
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map((node) => {
            return (
              <div key={node.path}>
                {renderNode({
                  ...node,
                })}
              </div>
            );
          })}
      </div>
    );
  };

  // FIX: Force expand all folders on load
  React.useEffect(() => {
    const allPaths = new Set<string>();
    const traverse = (node: FileNode) => {
      if (node.type === "folder") {
        allPaths.add(node.path);
        if (node.children) {
          Object.values(node.children).forEach(traverse);
        }
      }
    };
    Object.values(tree).forEach(traverse);
    setExpandedFolders(allPaths);
  }, [tree]);

  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editor-background)",
        border: "1px solid var(--vscode-widget-border)",
        borderRadius: "6px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        width: "300px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "400px",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--vscode-widget-border)",
          fontWeight: 600,
          fontSize: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Changes</span>
          <span
            style={{
              backgroundColor: "var(--vscode-badge-background)",
              color: "var(--vscode-badge-foreground)",
              borderRadius: "10px",
              padding: "0 6px",
              fontSize: "10px",
            }}
          >
            {changes.length}
          </span>
        </div>
        {onClose && (
          <div
            onClick={onClose}
            style={{ cursor: "pointer", opacity: 0.7 }}
            className="hover:opacity-100"
          >
            ✕
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>{renderRoot()}</div>

      {onCommit && changes.length > 0 && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--vscode-widget-border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCommit}
            style={{
              backgroundColor: "var(--vscode-button-background)",
              color: "var(--vscode-button-foreground)",
              border: "none",
              padding: "4px 12px",
              borderRadius: "2px",
              cursor: "pointer",
              fontSize: "12px",
            }}
            className="hover:bg-[var(--vscode-button-hoverBackground)]"
          >
            Commit Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default ChangesTree;
