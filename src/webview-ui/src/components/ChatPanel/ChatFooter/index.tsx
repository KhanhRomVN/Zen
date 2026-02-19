import React, { useState, useRef, useEffect } from "react";

import ProjectStructureDrawer from "./components/ProjectStructureDrawer";
import ProjectContextModal from "./ProjectContextModal";
import BlacklistManager from "../../SettingsPanel/BlacklistManager";

import { ChatFooterProps } from "./types";

interface ExtendedChatFooterProps extends ChatFooterProps {
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  onExecutePendingBatch?: () => void;
  hasPendingActions?: boolean;
  folderPath?: string | null;
  isConversationStarted?: boolean;
  hasTaskProgress?: boolean;
  selectedQuickModel?: {
    providerId: string;
    modelId: string;
    accountId?: string;
  } | null;
  onQuickModelSelect?: (
    model: { providerId: string; modelId: string; accountId?: string } | null,
  ) => void;
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
  onToggleTaskDrawer?: () => void;
  isProcessing?: boolean;
  // 🆕 Stop Generation Props
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  // 🆕 Backup Props
  onToggleBackupDrawer?: () => void;
  hasBackupEvents?: boolean;
  backupEventCount?: number;
  // 🆕 Blacklist Props
  onToggleBlacklistDrawer?: () => void;
}

// Hooks
import { useWorkspaceData } from "./hooks/useWorkspaceData";
import { useFileHandling } from "./hooks/useFileHandling";
import { useMentionSystem } from "./hooks/useMentionSystem";

// Components
import FilesPreviews from "./components/FilesPreviews";
import MentionDropdowns from "./components/MentionDropdowns";
import MessageInput from "./components/MessageInput";

const ChatFooter: React.FC<ExtendedChatFooterProps> = ({
  onSendMessage,
  isHistoryMode = false,
  messages,
  executionState,
  onExecutePendingBatch,
  hasPendingActions,
  folderPath,
  isConversationStarted,
  hasTaskProgress,
  selectedQuickModel,
  onQuickModelSelect,
  currentModel,
  setCurrentModel,
  currentAccount,
  setCurrentAccount,
  onToggleTaskDrawer,
  isProcessing,
  isStreaming,
  onStopGeneration,
  onToggleBackupDrawer,
  hasBackupEvents,
  backupEventCount,
  onToggleBlacklistDrawer,
}: ExtendedChatFooterProps) => {
  const [message, setMessage] = useState("");
  // const [showOptionsDrawer, setShowOptionsDrawer] = useState(false); // Removed
  const [showProjectStructureDrawer, setShowProjectStructureDrawer] =
    useState(false);
  const [showChangesDropdown, setShowChangesDropdown] = useState(false);
  const [showProjectContextModal, setShowProjectContextModal] = useState(false);
  const [isBlacklistDrawerOpen, setIsBlacklistDrawerOpen] = useState(false);
  const [projectContext, setProjectContext] = useState<any>(null); // Use proper type if available
  const [agentPermissions, setAgentPermissions] = useState({
    allowFileRead: true,
    allowFileEdit: false,
    allowFileAdd: false,
    allowCommandExecution: false,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // Load Project Context
  useEffect(() => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "loadProjectContext" });
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "projectContextResponse") {
        setProjectContext(message.context);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSaveProjectContext = (context: any) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      // Optimistic update
      setProjectContext(context);
      vscodeApi.postMessage({
        command: "saveProjectContext",
        context,
      });
      setShowProjectContextModal(false);
    }
  };

  // Workspace Data Hook
  const {
    availableFiles,
    availableFolders,
    blacklist,
    availableRules,
    getGitCommitMessage,
  } = useWorkspaceData();

  // Mention System Hook
  const {
    showAtMenu,
    setShowAtMenu,
    showMentionDropdown,
    setShowMentionDropdown,
    mentionType,
    setMentionType, // Exposed for external file input closing dropdown
    attachedItems,
    checkMentions,
    handleMentionOptionSelect,
    handleWorkspaceItemSelect,
    handleRuleSelect,
    removeAttachedItem,
    clearAttachedItems,
    addAttachedItem,
  } = useMentionSystem({
    message,
    setMessage,
    textareaRef,
    availableFiles,
    availableFolders,
    onRequestWorkspaceFiles: () => {
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({ command: "getWorkspaceFiles" });
      }
    },
    onRequestWorkspaceFolders: () => {
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({ command: "getWorkspaceFolders" });
      }
    },
  });

  // File Handling Hook
  const {
    uploadedFiles,
    externalFiles, // eslint-disable-line @typescript-eslint/no-unused-vars
    fileInputRef,
    externalFileInputRef,
    handlePaste,
    handleFileSelect,
    handleFileInputChange,
    removeFile,
    handleExternalFileSelect,
    handleExternalFileInputChange,
    handleDragOver,
    handleDrop,
    clearFiles,
  } = useFileHandling({
    onAddAttachedItem: (item) => {
      addAttachedItem(item);
      // If adding external file from menu, we should close the menu
      setShowAtMenu(false);
    },
  });

  // Agent Options Helper - REMOVED

  // Handle Send Message
  const handleSend = (model: any, account: any, thinking?: boolean) => {
    if (message.trim() || uploadedFiles.length > 0) {
      // Sync permissions with extension
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({
          command: "updateAgentPermissions",
          permissions: agentPermissions,
        });
      }

      onSendMessage(
        message,
        uploadedFiles,
        model || currentModel,
        account || currentAccount,
        undefined, // skipFirstRequestLogic - always false for user input
        undefined, // actionIds
        undefined, // uiHidden
        thinking,
      );
      setMessage("");
      clearFiles();
      clearAttachedItems();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  // Handle Git Commit Generation
  const handleGitCommit = async () => {
    if (message.trim() !== "") return;
    const prompt = await getGitCommitMessage();
    if (prompt) {
      setMessage(prompt);
      textareaRef.current?.focus();
    }
  };

  // Handle Textarea Change
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    checkMentions(value);
  };

  // Auto-resize textarea when message changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        240,
      )}px`;
    }
  }, [message]);

  // Handle Open Image
  const handleOpenImage = (file: any) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openTempImage",
        content: file.content,
        filename: file.name,
      });
    }
  };

  // Handle Click Outside (for dropdowns)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (showAtMenu) {
        const menu = document.querySelector('[data-at-menu="true"]');
        if (menu && !menu.contains(target) && target !== textareaRef.current) {
          setShowAtMenu(false);
        }
      }

      if (showMentionDropdown) {
        const dropdown = document.querySelector(
          '[data-mention-dropdown="true"]',
        );
        if (dropdown && !dropdown.contains(target)) {
          setShowMentionDropdown(false);
          setMentionType(null);
        }
      }
      // showOptionsDrawer logic removed
    };

    if (showAtMenu || showMentionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showAtMenu,
    showMentionDropdown,
    setShowAtMenu,
    setShowMentionDropdown,
    setMentionType,
  ]);

  return (
    <div
      id="chat-footer-container"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 100,
      }}
    >
      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileInputChange}
        accept="image/*,text/*"
      />
      <input
        ref={externalFileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleExternalFileInputChange}
      />

      <FilesPreviews
        uploadedFiles={uploadedFiles}
        attachedItems={attachedItems}
        onRemoveFile={removeFile}
        onRemoveAttachedItem={removeAttachedItem}
        onOpenImage={handleOpenImage}
        onAttachedItemClick={(item) => {
          if (item.type === "file") {
            const vscodeApi = (window as any).vscodeApi;
            if (vscodeApi) {
              vscodeApi.postMessage({
                command: "openWorkspaceFile",
                path: item.path,
              });
            }
          }
        }}
      />

      <MessageInput
        message={message}
        setMessage={setMessage}
        isHistoryMode={isHistoryMode}
        uploadedFiles={uploadedFiles}
        textareaRef={textareaRef}
        handleTextareaChange={handleTextareaChange}
        handleKeyDown={(e: React.KeyboardEvent) => {
          // MessageInput handles Enter key for sending
          // This prop is now only for other global key handlers if any
        }}
        handlePaste={handlePaste}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        setShowAtMenu={setShowAtMenu}
        handleFileSelect={handleFileSelect}
        onOpenProjectStructure={() => {
          setShowProjectStructureDrawer(true);
          const vscodeApi = (window as any).vscodeApi;
          if (vscodeApi) {
            if (availableFiles.length === 0 || availableFolders.length === 0) {
              vscodeApi.postMessage({ command: "getWorkspaceFiles" });
              vscodeApi.postMessage({ command: "getWorkspaceFolders" });
            }
            vscodeApi.postMessage({
              command: "getProjectStructureBlacklist",
            });
          }
        }}
        showChangesDropdown={showChangesDropdown}
        setShowChangesDropdown={setShowChangesDropdown}
        messages={messages}
        handleGitCommit={handleGitCommit}
        // setShowOptionsDrawer={setShowOptionsDrawer} // Removed
        handleSend={(model: any, account: any, thinking?: boolean) =>
          handleSend(model, account, thinking)
        }
        hasProjectContext={!!projectContext}
        onOpenProjectContext={() => setShowProjectContextModal(true)}
        executionState={executionState}
        onExecutePendingBatch={onExecutePendingBatch}
        hasPendingActions={hasPendingActions}
        folderPath={folderPath}
        isConversationStarted={isConversationStarted}
        hasTaskProgress={hasTaskProgress}
        selectedQuickModel={selectedQuickModel}
        onQuickModelSelect={onQuickModelSelect}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
        onToggleTaskDrawer={onToggleTaskDrawer}
        isProcessing={isProcessing}
        isStreaming={isStreaming}
        onStopGeneration={onStopGeneration}
        onToggleBackupDrawer={onToggleBackupDrawer}
        hasBackupEvents={hasBackupEvents}
        backupEventCount={backupEventCount}
        onToggleBlacklistDrawer={() =>
          setIsBlacklistDrawerOpen(!isBlacklistDrawerOpen)
        }
        agentPermissions={agentPermissions}
        onUpdateAgentPermissions={setAgentPermissions}
      />

      <MentionDropdowns
        showAtMenu={showAtMenu}
        showMentionDropdown={showMentionDropdown}
        mentionType={mentionType}
        availableFiles={availableFiles}
        availableFolders={availableFolders}
        availableRules={availableRules}
        message={message}
        handleMentionOptionSelect={handleMentionOptionSelect}
        handleExternalFileSelect={handleExternalFileSelect}
        handleWorkspaceItemSelect={handleWorkspaceItemSelect}
        handleRuleSelect={handleRuleSelect}
        mentionDropdownRef={mentionDropdownRef}
      />

      {/* AgentOptionsDrawer removed */}

      <ProjectStructureDrawer
        isOpen={showProjectStructureDrawer}
        onClose={() => setShowProjectStructureDrawer(false)}
        files={availableFiles}
        folders={availableFolders}
        blacklist={blacklist}
        onRefresh={() => {
          const vscodeApi = (window as any).vscodeApi;
          if (vscodeApi) {
            vscodeApi.postMessage({ command: "getWorkspaceFiles" });
            vscodeApi.postMessage({ command: "getWorkspaceFolders" });
            vscodeApi.postMessage({
              command: "getProjectStructureBlacklist",
            });
          }
        }}
      />

      <ProjectContextModal
        isOpen={showProjectContextModal}
        onClose={() => setShowProjectContextModal(false)}
        initialContext={projectContext}
        onSave={handleSaveProjectContext}
      />

      {/* 🆕 Blacklist Drawer */}
      {isBlacklistDrawerOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "100%", // Open above ChatFooter
            left: 0,
            right: 0,
            backgroundColor: "var(--secondary-bg)",
            borderTop: "1px solid var(--border-color)",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
            zIndex: 1000,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "var(--tertiary-bg)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
              Backup Blacklist
            </h3>
            <div
              style={{ cursor: "pointer", opacity: 0.7 }}
              onClick={() => setIsBlacklistDrawerOpen(false)}
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
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "16px", overflowY: "auto" }}>
            <BlacklistManager />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatFooter;
