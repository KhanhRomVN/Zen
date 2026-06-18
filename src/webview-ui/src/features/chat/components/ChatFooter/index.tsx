import React, { useState, useRef, useEffect, useCallback } from "react";

import ProjectStructureDrawer from "./components/ProjectStructureDrawer";
import ProjectContextModal from "./ProjectContextModal";
import { useBackendConnection } from "../../../../context/BackendConnectionContext";

import { ChatFooterProps } from "./types";

interface ExtendedChatFooterProps extends ChatFooterProps {
  apiUrl?: string;
  folderPath?: string | null;
  isConversationStarted?: boolean;
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
  isProcessing?: boolean;
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  initialValue?: string;
  initialValueNonce?: number;
  conversationId?: string;
  autoScrollPaused?: boolean;
  onResumeScroll?: () => void;
}

// Hooks
import { useWorkspaceData } from "./hooks/useWorkspaceData";
import { useFileHandling } from "./hooks/useFileHandling";
import { useMentionSystem } from "./hooks/useMentionSystem";

// Components
import FilesPreviews from "./components/FilesPreviews";
import MentionDropdowns from "./components/MentionDropdowns";
import MessageInput from "./components/MessageInput";
import { extensionService } from "../../../../services/ExtensionService";

const ChatFooter: React.FC<ExtendedChatFooterProps> = ({
  onSendMessage,
  isHistoryMode = false,
  messages,
  folderPath,
  isConversationStarted,
  currentModel,
  setCurrentModel,
  currentAccount,
  setCurrentAccount,
  isProcessing,
  isStreaming,
  onStopGeneration,
  initialValue,
  initialValueNonce,
  conversationId,
  autoScrollPaused,
  onResumeScroll,
}) => {
  const [message, setMessage] = useState("");
  const storage = extensionService.getStorage();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraftRestoredRef = useRef(false);

  // Undo stack for Ctrl+Z support
  const undoStackRef = useRef<string[]>([]);
  const undoIndexRef = useRef<number>(-1);
  const isUndoingRef = useRef(false);

  // Restore draft when conversationId changes
  useEffect(() => {
    if (!conversationId) return;
    isDraftRestoredRef.current = false;
    storage
      .get(`draft:${conversationId}`)
      .then((res: any) => {
        // Don't restore draft if an initialValue was explicitly provided
        if (res?.value && !isDraftRestoredRef.current && !initialValue) {
          setMessage(res.value);
          // Seed undo stack with restored draft
          undoStackRef.current = [res.value];
          undoIndexRef.current = 0;
        }
        isDraftRestoredRef.current = true;
      })
      .catch(() => {
        isDraftRestoredRef.current = true;
      });
  }, [conversationId]);

  // Debounce-save draft on message change
  useEffect(() => {
    if (!conversationId || !isDraftRestoredRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (message.trim()) {
        storage.set(`draft:${conversationId}`, message).catch(() => {});
      } else {
        storage.delete(`draft:${conversationId}`).catch(() => {});
      }
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [message, conversationId]);

  useEffect(() => {
    if (initialValue !== undefined) {
      setMessage(initialValue || "");
      // Reset undo stack when initial value is injected externally
      undoStackRef.current = initialValue ? [initialValue] : [];
      undoIndexRef.current = initialValue ? 0 : -1;
    }
  }, [initialValue, initialValueNonce]);
  // const [showOptionsDrawer, setShowOptionsDrawer] = useState(false); // Removed
  const [showProjectStructureDrawer, setShowProjectStructureDrawer] =
    useState(false);
  const [showChangesDropdown, setShowChangesDropdown] = useState(false);
  const [showProjectContextModal, setShowProjectContextModal] = useState(false);
  const [projectContext, setProjectContext] = useState<any>(null); // Use proper type if available
  const { apiUrl } = useBackendConnection();

  // Browser session state
  const [isBrowserSessionReady, setIsBrowserSessionReady] = useState(false);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);

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
      } else if (message.command === "addAttachedItem") {
        const isFolder =
          message.itemType === "folder" ||
          (!message.uri.includes(".") && !message.itemType);
        addAttachedItem({
          id: Math.random().toString(36).substring(7),
          path: message.uri,
          type: isFolder ? "folder" : "file",
        });
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
  const { availableFiles, availableFolders, availableRules } =
    useWorkspaceData();

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
    accountId: currentAccount?.id,
    onAddAttachedItem: (item) => {
      addAttachedItem(item);
      // If adding external file from menu, we should close the menu
      setShowAtMenu(false);
    },
  });

  // Agent Options Helper - REMOVED

  // Handle Send Message
  const handleSend = (model: any, account: any) => {
    if (
      message.trim() ||
      uploadedFiles.length > 0 ||
      attachedItems.length > 0
    ) {
      onSendMessage(
        message,
        [...uploadedFiles, ...attachedItems],
        model || currentModel,
        account || currentAccount,
        undefined, // skipFirstRequestLogic - always false for user input
        undefined, // actionIds
        undefined, // uiHidden
      );
      setMessage("");
      if (conversationId)
        storage.delete(`draft:${conversationId}`).catch(() => {});
      clearFiles();
      clearAttachedItems();
      // Reset undo stack after send
      undoStackRef.current = [];
      undoIndexRef.current = -1;
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } else {
      console.warn(
        "[Zen] ChatFooter handleSend: nothing to send (empty message, no files)",
      );
    }
  };

  // Browser session functions
  const checkBrowserSession = useCallback(async () => {
    if (!currentModel || currentModel.providerId !== "zai-browser") {
      setIsBrowserSessionReady(true);
      setShowBrowserWarning(false);
      return;
    }

    if (!currentAccount?.id) {
      setIsBrowserSessionReady(false);
      setShowBrowserWarning(true);
      return;
    }

    try {
      const response = await fetch(
        `${apiUrl}/v1/accounts/${currentAccount.id}/browser/status`,
      );
      const result = await response.json();
      if (result.success && result.data) {
        if (result.data.has_profile && result.data.is_running) {
          setIsBrowserSessionReady(true);
          setShowBrowserWarning(false);
        } else {
          setIsBrowserSessionReady(false);
          setShowBrowserWarning(true);
        }
      } else {
        setIsBrowserSessionReady(false);
        setShowBrowserWarning(true);
      }
    } catch (error) {
      console.error("Failed to check browser session:", error);
      setIsBrowserSessionReady(false);
      setShowBrowserWarning(true);
    }
  }, [currentModel, currentAccount, apiUrl]);

  const launchBrowserSession = async () => {
    if (!currentModel || !currentAccount) return;
    setIsLaunchingBrowser(true);
    try {
      const response = await fetch(
        `${apiUrl}/v1/accounts/${currentAccount.id}/browser/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const result = await response.json();
      if (result.success) {
        setIsBrowserSessionReady(true);
        setShowBrowserWarning(false);
      } else {
        console.error("Failed to launch browser:", result.message);
      }
    } catch (error) {
      console.error("Failed to launch browser:", error);
    } finally {
      setIsLaunchingBrowser(false);
    }
  };

  useEffect(() => {
    checkBrowserSession();
  }, [checkBrowserSession]);

  useEffect(() => {
    if (
      !currentModel ||
      currentModel.providerId !== "zai-browser" ||
      !currentAccount?.id
    )
      return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${apiUrl}/v1/accounts/${currentAccount.id}/browser/status`,
        );
        const result = await response.json();
        if (result.success && result.data) {
          const isRunning = result.data.is_running === true;
          setIsBrowserSessionReady(isRunning);
          setShowBrowserWarning(!isRunning);
        }
      } catch (error) {
        console.error("Polling browser status failed:", error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentModel, currentAccount?.id, apiUrl]);

  // Handle Git Commit Generation removed

  // Handle Textarea Change
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    // Push to undo stack (only when not triggered by undo/redo)
    if (!isUndoingRef.current) {
      // Truncate any redo history when user types new content
      const newStack = undoStackRef.current.slice(0, undoIndexRef.current + 1);
      newStack.push(value);
      undoStackRef.current = newStack;
      undoIndexRef.current = newStack.length - 1;
    }

    setMessage(value);
    checkMentions(value);
  };

  // Handle Ctrl+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isUndo = (e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey;
    const isRedo =
      ((e.ctrlKey || e.metaKey) && e.key === "y") ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z");

    if (isUndo) {
      e.preventDefault();
      if (undoIndexRef.current > 0) {
        isUndoingRef.current = true;
        undoIndexRef.current -= 1;
        const prev = undoStackRef.current[undoIndexRef.current];
        setMessage(prev);
        checkMentions(prev);
        isUndoingRef.current = false;
      } else if (undoIndexRef.current === 0) {
        // Undo back to empty
        isUndoingRef.current = true;
        undoIndexRef.current = -1;
        setMessage("");
        checkMentions("");
        isUndoingRef.current = false;
      }
      return;
    }

    if (isRedo) {
      e.preventDefault();
      if (undoIndexRef.current < undoStackRef.current.length - 1) {
        isUndoingRef.current = true;
        undoIndexRef.current += 1;
        const next = undoStackRef.current[undoIndexRef.current];
        setMessage(next);
        checkMentions(next);
        isUndoingRef.current = false;
      }
      return;
    }
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

  // Get browser warning state from parent or manage locally
  // For now, we'll assume it's passed via props or context
  // Temporary: check currentModel to determine if warning should show
  const showWarning =
    showBrowserWarning && currentModel?.providerId === "zai-browser";

  // Dynamic bottom padding based on browser warning
  const footerPaddingBottom =
    showBrowserWarning && currentModel?.providerId === "zai-browser"
      ? "20px"
      : "8px";

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
        transition: "bottom 0.2s ease",
        paddingBottom: footerPaddingBottom,
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
          const vscodeApi = (window as any).vscodeApi;
          if (!vscodeApi) return;

          if (item.type === "file") {
            vscodeApi.postMessage({
              command: "openWorkspaceFile",
              path: item.path,
            });
          } else if (item.type === "folder") {
            vscodeApi.postMessage({
              command: "openWorkspaceFolder",
              path: item.path,
            });
          } else if (item.type === ("terminal" as any)) {
            vscodeApi.postMessage({
              command: "focusTerminal",
              terminalId: item.path,
            });
          }
        }}
      />

      <div style={{ position: "relative" }}>
        {autoScrollPaused && (
          <button
            onClick={onResumeScroll}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--input-bg)";
            }}
            style={{
              position: "absolute",
              bottom: "100%",
              right: "8px",
              marginBottom: "-1px",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 10px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: "var(--input-bg)",
              color: "var(--primary-text)",
              borderTopLeftRadius: "8px",
              borderTopRightRadius: "8px",
              borderBottomLeftRadius: "0",
              borderBottomRightRadius: "0",
              border: "1px solid var(--border-color)",
              borderBottom: "none",
              boxShadow: "0 -2px 6px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
            }}
          >
            <span
              className="codicon codicon-arrow-down"
              style={{ fontSize: "12px" }}
            />
            Resume scroll
          </button>
        )}
        <MessageInput
          message={message}
          setMessage={setMessage}
          isHistoryMode={isHistoryMode}
          uploadedFiles={uploadedFiles}
          textareaRef={textareaRef}
          handleTextareaChange={handleTextareaChange}
          handleKeyDown={handleKeyDown}
          handlePaste={handlePaste}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          setShowAtMenu={setShowAtMenu}
          handleFileSelect={handleFileSelect}
          onOpenProjectStructure={() => setShowProjectStructureDrawer(true)}
          showChangesDropdown={showChangesDropdown}
          setShowChangesDropdown={setShowChangesDropdown}
          messages={messages}
          handleSend={handleSend}
          hasProjectContext={!!projectContext}
          onOpenProjectContext={() => setShowProjectContextModal(true)}
          folderPath={folderPath}
          isConversationStarted={isConversationStarted}
          currentModel={currentModel}
          setCurrentModel={setCurrentModel}
          currentAccount={currentAccount}
          setCurrentAccount={setCurrentAccount}
          isProcessing={isProcessing}
          isStreaming={isStreaming}
          onStopGeneration={onStopGeneration}
          showBrowserWarning={showBrowserWarning}
          isLaunchingBrowser={isLaunchingBrowser}
          onLaunchBrowserSession={launchBrowserSession}
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
      </div>

      <ProjectStructureDrawer
        isOpen={showProjectStructureDrawer}
        onClose={() => setShowProjectStructureDrawer(false)}
        files={availableFiles}
        folders={availableFolders}
        onRefresh={() => {
          const vscodeApi = (window as any).vscodeApi;
          if (vscodeApi) {
            vscodeApi.postMessage({ command: "getWorkspaceFiles" });
            vscodeApi.postMessage({ command: "getWorkspaceFolders" });
          }
        }}
      />

      <ProjectContextModal
        isOpen={showProjectContextModal}
        onClose={() => setShowProjectContextModal(false)}
        initialContext={projectContext}
        onSave={handleSaveProjectContext}
      />
    </div>
  );
};

export default ChatFooter;
