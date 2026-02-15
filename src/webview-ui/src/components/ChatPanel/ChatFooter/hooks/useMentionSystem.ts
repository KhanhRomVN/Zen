import { useState } from "react";
import { AttachedItem, WorkspaceItem, Rule } from "../types";

interface UseMentionSystemProps {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  availableFiles: WorkspaceItem[];
  availableFolders: WorkspaceItem[];
  onRequestWorkspaceFiles: () => void;
  onRequestWorkspaceFolders: () => void;
}

export const useMentionSystem = ({
  message,
  setMessage,
  textareaRef,
  availableFiles,
  availableFolders,
  onRequestWorkspaceFiles,
  onRequestWorkspaceFolders,
}: UseMentionSystemProps) => {
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionType, setMentionType] = useState<
    "files" | "folders" | "rules" | "conver" | null
  >(null);
  const [attachedItems, setAttachedItems] = useState<AttachedItem[]>([]);

  const checkMentions = (value: string) => {
    // Check if user typed "@" at the end
    if (value.endsWith("@")) {
      setShowAtMenu(true);
    } else if (showAtMenu && !value.includes("@")) {
      setShowAtMenu(false);
    }

    // Check for @file: or @folder: pattern
    const fileMatch = value.match(/@file:\s*([^\s]*)$/);
    const folderMatch = value.match(/@folder:\s*([^\s]*)$/);

    if (fileMatch) {
      setMentionType("files");
      setShowMentionDropdown(true);
      // Request files if not already loaded
      if (availableFiles.length === 0) {
        onRequestWorkspaceFiles();
      }
    } else if (folderMatch) {
      setMentionType("folders");
      setShowMentionDropdown(true);
      // Request folders if not already loaded
      if (availableFolders.length === 0) {
        onRequestWorkspaceFolders();
      }
    } else {
      setShowMentionDropdown(false);
      setMentionType(null);
    }
  };

  const handleMentionOptionSelect = (option: string) => {
    if (option === "files") {
      // Replace @ with @file:
      setMessage((prev) => prev.slice(0, -1) + "@file: ");
      setMentionType("files");
      setShowMentionDropdown(true);
      onRequestWorkspaceFiles();
    } else if (option === "folders") {
      // Replace @ with @folder:
      setMessage((prev) => prev.slice(0, -1) + "@folder: ");
      setMentionType("folders");
      setShowMentionDropdown(true);
      onRequestWorkspaceFolders();
    } else if (option === "rules") {
      // Show rules dropdown
      setMessage((prev) => prev.slice(0, -1)); // Remove @
      setMentionType("rules");
      setShowMentionDropdown(true);
    } else if (option === "conver") {
      // Placeholder for future implementation
    }
    setShowAtMenu(false);
    textareaRef.current?.focus();
  };

  const handleWorkspaceItemSelect = (item: WorkspaceItem) => {
    // Remove the @file: or @folder: pattern from message
    setMessage((prev) => {
      if (mentionType === "files") {
        return prev.replace(/@file:\s*[^\s]*$/, "");
      } else if (mentionType === "folders") {
        return prev.replace(/@folder:\s*[^\s]*$/, "");
      }
      return prev;
    });

    // Add to attached items
    const newItem: AttachedItem = {
      id: `attached-${Date.now()}-${Math.random()}`,
      path: item.path,
      type: item.type,
    };
    setAttachedItems((prev) => [...prev, newItem]);
    setShowMentionDropdown(false);
    setMentionType(null);
    textareaRef.current?.focus();
  };

  const handleRuleSelect = (rule: Rule) => {
    // Add rule to attached items
    const newItem: AttachedItem = {
      id: `rule-${rule.id}`,
      path: rule.name, // Use rule name as path
      type: "file", // Use file type for rules (will be distinguished by id prefix)
    };
    setAttachedItems((prev) => [...prev, newItem]);
    setShowMentionDropdown(false);
    setMentionType(null);
    textareaRef.current?.focus();
  };

  const removeAttachedItem = (itemId: string) => {
    setAttachedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearAttachedItems = () => {
    setAttachedItems([]);
  };

  // Add a way to manually add attached items (e.g. from external files)
  const addAttachedItem = (item: AttachedItem) => {
    setAttachedItems((prev) => [...prev, item]);
  };

  return {
    showAtMenu,
    setShowAtMenu,
    showMentionDropdown,
    setShowMentionDropdown,
    mentionType,
    setMentionType,
    attachedItems,
    checkMentions,
    handleMentionOptionSelect,
    handleWorkspaceItemSelect,
    handleRuleSelect,
    removeAttachedItem,
    clearAttachedItems,
    addAttachedItem,
  };
};
