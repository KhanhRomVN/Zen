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

interface MentionDropdownsProps {
  showAtMenu: boolean;
  showMentionDropdown: boolean;
  mentionType: "files" | "folders" | "rules" | "conver" | null;
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
  return (
    <>
      {/* @ Menu Dropdown */}
      {showAtMenu && (
        <div
          data-at-menu="true"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "var(--spacing-lg)",
            right: "var(--spacing-lg)",
            marginBottom: "var(--spacing-xs)",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius)",
            boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
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
              margin: "var(--spacing-xs) 0",
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
              margin: "var(--spacing-xs) 0",
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
      {showMentionDropdown && mentionType && (
        <div
          ref={mentionDropdownRef}
          data-mention-dropdown="true"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "var(--spacing-lg)",
            right: "var(--spacing-lg)",
            marginBottom: "var(--spacing-xs)",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius)",
            boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {mentionType === "files" &&
            getFilteredItems(availableFiles, message).map((file) => (
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
                  gap: "var(--spacing-xs)",
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
                  style={{ width: "14px", height: "14px" }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.path}
                </span>
              </div>
            ))}
          {mentionType === "folders" &&
            getFilteredItems(availableFolders, message).map((folder) => (
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
                  gap: "var(--spacing-xs)",
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
                  style={{ width: "14px", height: "14px" }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {folder.path}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Rules Dropdown */}
      {showMentionDropdown && mentionType === "rules" && (
        <div
          ref={mentionDropdownRef}
          data-mention-dropdown="true"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "var(--spacing-lg)",
            right: "var(--spacing-lg)",
            marginBottom: "var(--spacing-xs)",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius)",
            boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
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
      )}
    </>
  );
};

export default MentionDropdowns;
