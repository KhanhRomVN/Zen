import React from "react";
import { WorkspaceItem, Rule } from "../types";
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  LawIcon,
  MessageIcon,
} from "./Icons";
import FileImageIcon from "../../../common/FileIcon";
import { getFilteredItems } from "../utils";
import { Search, X, Clock, Terminal } from "lucide-react";

const shortenPath = (path: string, maxLength: number = 40) => {
  if (path.length <= maxLength) return path;
  const parts = path.split("/");
  if (parts.length <= 2) return path;
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first}/../${last}`;
};

interface MentionDropdownsProps {
  showAtMenu: boolean;
  showMentionDropdown: boolean;
  mentionType: "files" | "folders" | "rules" | "conver" | "terminal" | null;
  availableFiles: WorkspaceItem[];
  availableFolders: WorkspaceItem[];
  availableRules: Rule[];
  message: string;
  handleMentionOptionSelect: (option: string) => void;
  handleExternalFileSelect: () => void;
  handleWorkspaceItemSelect: (item: WorkspaceItem) => void;
  handleRuleSelect: (rule: Rule) => void;
  mentionDropdownRef: React.RefObject<HTMLDivElement>;
}

const MentionDropdowns: React.FC<MentionDropdownsProps> = ({
  showAtMenu,
  showMentionDropdown,
  mentionType,
  availableFiles,
  availableFolders,
  availableRules,
  message,
  handleMentionOptionSelect,
  handleExternalFileSelect,
  handleWorkspaceItemSelect,
  handleRuleSelect,
  mentionDropdownRef,
}) => {
  const [localSearch, setLocalSearch] = React.useState("");

  // Reset local search when dropdown changes or closes
  React.useEffect(() => {
    if (!showMentionDropdown) {
      setLocalSearch("");
    }
  }, [showMentionDropdown, mentionType]);

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(100% - var(--spacing-md))",
    left: "24px",
    right: "24px",
    marginBottom: "2px",
    backgroundColor: "var(--primary-bg)",
    border: "1px solid var(--border-color)",
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.15)",
    zIndex: 1000,
    maxHeight: "300px",
    display: "flex",
    flexDirection: "column",
  };

  const filteredWorkspaceItems = React.useMemo(() => {
    const items = mentionType === "files" ? availableFiles : availableFolders;
    let filtered = items;
    if (localSearch) {
      filtered = items.filter((item) =>
        item.path.toLowerCase().includes(localSearch.toLowerCase()),
      );
    } else {
      filtered = getFilteredItems(items, message);
    }

    // Prioritize isRecent items, then sort by lastModified (already done for files in extension)
    return [...filtered].sort((a: any, b: any) => {
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;
      return 0; // Maintain existing order (lastModified for files)
    });
  }, [mentionType, availableFiles, availableFolders, localSearch, message]);

  const renderSearchBar = () => (
    <div
      style={{
        padding: "8px",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        backgroundColor: "var(--secondary-bg)",
        borderTopLeftRadius: "8px",
        borderTopRightRadius: "8px",
      }}
    >
      <Search size={14} style={{ color: "var(--secondary-text)" }} />
      <input
        autoFocus
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        placeholder={`Search ${mentionType}...`}
        style={{
          flex: 1,
          backgroundColor: "transparent",
          border: "none",
          outline: "none",
          color: "var(--primary-text)",
          fontSize: "var(--font-size-sm)",
        }}
      />
      {localSearch && (
        <X
          size={14}
          style={{ cursor: "pointer", color: "var(--secondary-text)" }}
          onClick={() => setLocalSearch("")}
        />
      )}
    </div>
  );
  return (
    <>
      {/* @ Menu Dropdown */}
      {showAtMenu && (
        <div
          data-at-menu="true"
          style={{
            ...dropdownStyle,
            maxHeight: "none",
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          {/* Files option */}
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              cursor: "pointer",
              transition: "background-color 0.2s",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
            onClick={() => handleMentionOptionSelect("files")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FileIcon size={16} />
            <span>Files</span>
          </div>

          {/* Separator */}
          <div
            style={{
              height: "1px",
              backgroundColor: "var(--border-color)",
              margin: "0",
            }}
          />

          {/* Folders option */}
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              cursor: "pointer",
              transition: "background-color 0.2s",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
            onClick={() => handleMentionOptionSelect("folders")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FolderIcon size={16} />
            <span>Folders</span>
          </div>

          {/* Separator */}
          <div
            style={{
              height: "1px",
              backgroundColor: "var(--border-color)",
              margin: "0",
            }}
          />

          {/* External Files option */}
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              cursor: "pointer",
              transition: "background-color 0.2s",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
            onClick={handleExternalFileSelect}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FolderOpenIcon size={16} />
            <span>External Files</span>
          </div>

          {/* Separator */}
          <div
            style={{
              height: "1px",
              backgroundColor: "var(--border-color)",
              margin: "0",
            }}
          />

          {/* Rules option */}
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              cursor: "pointer",
              transition: "background-color 0.2s",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
            onClick={() => handleMentionOptionSelect("rules")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <LawIcon size={16} />
            <span>Rules</span>
          </div>

          {/* Separator */}
          <div
            style={{
              height: "1px",
              backgroundColor: "var(--border-color)",
              margin: "0",
            }}
          />

          {/* Terminal option */}
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              cursor: "pointer",
              transition: "background-color 0.2s",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
            onClick={() => handleMentionOptionSelect("terminal")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Terminal size={16} />
            <span>Terminal</span>
          </div>

          {/* Separator */}
          <div
            style={{
              height: "1px",
              backgroundColor: "var(--border-color)",
              margin: "0",
            }}
          />

          {/* Conversation option */}
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              cursor: "not-allowed",
              transition: "background-color 0.2s",
              fontSize: "var(--font-size-sm)",
              color: "var(--secondary-text)",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              opacity: 0.5,
            }}
          >
            <MessageIcon size={16} />
            <span>Conversation</span>
          </div>
        </div>
      )}

      {/* Workspace Items Dropdown (Files/Folders) */}
      {showMentionDropdown && mentionType && mentionType !== "rules" && (
        <div
          ref={mentionDropdownRef}
          data-mention-dropdown="true"
          style={dropdownStyle}
        >
          {renderSearchBar()}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {mentionType === "files" &&
              filteredWorkspaceItems.map((file) => (
                <div
                  key={file.path}
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                  }}
                  onClick={() => handleWorkspaceItemSelect(file)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <FileImageIcon
                    path={file.path}
                    style={{ width: "14px", height: "14px", flexShrink: 0 }}
                  />
                  <div
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span title={file.path}>
                      {shortenPath(file.path)}
                      {(file as any).lines !== undefined &&
                        ` (${(file as any).lines} lines)`}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      {(file as any).isRecent && (
                        <Clock
                          size={12}
                          style={{ color: "var(--accent-text)" }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {mentionType === "folders" &&
              filteredWorkspaceItems.map((folder) => (
                <div
                  key={folder.path}
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                  }}
                  onClick={() => handleWorkspaceItemSelect(folder)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <FileImageIcon
                    path={folder.path}
                    isFolder={true}
                    style={{ width: "14px", height: "14px", flexShrink: 0 }}
                  />
                  <span
                    title={folder.path}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      {shortenPath(folder.path)}
                      {(folder as any).fileCount !== undefined &&
                        ` (${(folder as any).fileCount} files)`}
                    </span>
                    {(folder as any).isRecent && (
                      <Clock
                        size={12}
                        style={{ color: "var(--accent-text)" }}
                      />
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Rules Dropdown */}
      {showMentionDropdown && mentionType === "rules" && (
        <div
          ref={mentionDropdownRef}
          data-mention-dropdown="true"
          style={dropdownStyle}
        >
          <div style={{ overflowY: "auto", flex: 1 }}>
            {availableRules.length === 0 ? (
              <div
                style={{
                  padding: "var(--spacing-md)",
                  textAlign: "center",
                  color: "var(--secondary-text)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                No rules available. Create rules in Settings → Rules Management.
              </div>
            ) : (
              availableRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                  onClick={() => handleRuleSelect(rule)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <LawIcon size={14} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "2px" }}>
                      {rule.name}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--secondary-text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rule.content.substring(0, 60)}
                      {rule.content.length > 60 ? "..." : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MentionDropdowns;
