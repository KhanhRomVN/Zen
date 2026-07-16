import React from "react";
import { PlusIcon, SendIcon } from "@/icons/Icon";
import { X, GitPullRequestArrow } from "lucide-react";
import { useBackendConnection } from "../../context/BackendConnectionContext";
import { LANGUAGES } from "../../features/setting/components/LanguageSelector";
import { useSettings } from "../../context/SettingsContext";
import ModelAccountDrawer from "./ModelAccountDrawer";
import DiffSummaryBar from "./DiffSummaryBar";
import { ThinkingButton, SearchButton, MemoryButton } from "./ToggleButtons";
import { CompressButton } from "./CompressButton";
import { GlobalPermissionButton } from "./GlobalPermissionButton";
import {
  useToggleState,
  useModelCapabilities,
  useProvidersConfig,
  useTextareaAutoResize,
  useModelSelection,
} from "./hooks";
import type { MessageInputProps, UploadedFile } from "./types";

export type { UploadedFile };

const MessageInput: React.FC<MessageInputProps> = React.memo(
  ({
    message,
    setMessage,
    isHistoryMode = false,
    uploadedFiles,
    textareaRef,
    handleTextareaChange,
    handleKeyDown,
    handlePaste,
    handleDragOver,
    handleDrop,
    setShowAtMenu,
    handleFileSelect,
    fileInputRef,
    onOpenProjectStructure,
    showChangesDropdown,
    setShowChangesDropdown,
    messages,
    handleSend,
    hasProjectContext,
    onOpenProjectContext,
    folderPath,
    isConversationStarted,
    currentModel,
    setCurrentModel,
    currentAccount,
    setCurrentAccount,
    isProcessing,
    isStreaming,
    onStopGeneration,
    showBrowserWarning = false,
    isLaunchingBrowser = false,
    onLaunchBrowserSession,
    onGitPullRequest,
    isGitLoading = false,
    isGitStatusVisible = false,
    showCompressButton = false,
    gitStatus,
    onOpenGitStatus,
    conversationFileStats,
    onReviewClick,
    responseRange,
    responseRanges = [],
    onModelSwitch,
    onRevertConversation,
    autoScrollPaused = false,
    scrollToBottom,
  }) => {
    // 🔍 PERFORMANCE DEBUG LOGS
    const renderStartTime = performance.now();
    const renderCountRef = React.useRef(0);
    renderCountRef.current++;

    const { isConnected, isElaraMismatch, apiUrl } = useBackendConnection();
    const { aiLanguage: preferredLanguage } = useSettings();
    const [providers, setProviders] = React.useState<any[]>([]);
    const [showModelDrawer, setShowModelDrawer] = React.useState(false);
    const [pendingModelSwitch, setPendingModelSwitch] = React.useState<{
      model: any;
      account: any;
    } | null>(null);
    const [isModelSwitchMode, setIsModelSwitchMode] = React.useState(false);
    const [isPlusHovered, setIsPlusHovered] = React.useState(false);
    const [isGitHovered, setIsGitHovered] = React.useState(false);

    // Use custom hooks
    const [isThinking, toggleThinking, setIsThinking] = useToggleState(
      "zen-thinking-enabled",
    );
    const [isSearch, toggleSearch, setIsSearch] =
      useToggleState("zen-search-enabled");
    const [isMemory, , setIsMemory] = useToggleState("zen-memory-enabled");

    const { isLoadingCache, pendingAccountIdRef } = useModelSelection(
      folderPath,
      setCurrentModel,
      setCurrentAccount,
      currentModel,
      currentAccount,
    );

    const { currentProviderConfig, currentModelConfig } = useProvidersConfig(
      currentModel,
      providers,
    );

    const {
      showThinkingButton,
      showSearchButton,
      showMemoryButton,
      supportsUpload,
    } = useModelCapabilities(
      currentModel,
      currentModelConfig,
      currentProviderConfig,
    );

    useTextareaAutoResize(textareaRef, message);

    const displayModel = React.useMemo(() => {
      return currentModel || null;
    }, [currentModel]);

    const displayAccount = React.useMemo(() => {
      return currentAccount || null;
    }, [currentAccount]);

    const toggleMemory = async () => {
      if (!currentAccount?.id) {
        console.warn("No account selected, cannot toggle memory");
        return;
      }

      const newState = !isMemory;
      setIsMemory(newState);
      localStorage.setItem("zen-memory-enabled", String(newState));

      try {
        const response = await fetch(
          `${apiUrl}/v1/accounts/${currentAccount.id}/memory`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_memory_enabled: newState }),
          },
        );
        const result = await response.json();
        if (!result.success) {
          setIsMemory(!newState);
          localStorage.setItem("zen-memory-enabled", String(!newState));
          console.error(
            "Failed to update memory state on server:",
            result.message,
          );
        }
      } catch (error) {
        setIsMemory(!newState);
        localStorage.setItem("zen-memory-enabled", String(!newState));
        console.error("Failed to sync memory state with server:", error);
      }
    };

    const fetchProviders = React.useCallback(async () => {
      try {
        const response = await fetch(`${apiUrl}/v1/providers`);
        const result = await response.json();
        if (result.success) {
          setProviders(result.data.filter((p: any) => p.is_enabled));
        }
      } catch (error) {
        // console.error("Failed to fetch providers:", error);
      }
    }, [apiUrl]);

    // Initial fetch
    React.useEffect(() => {
      fetchProviders();
    }, [fetchProviders]);

    // Sync thinking and search toggles when model changes
    React.useEffect(() => {
      if (providers.length === 0 || !currentModel) return;
      const hasThinking =
        currentModel?.is_thinking !== undefined
          ? !!currentModel.is_thinking
          : !!currentModelConfig?.is_thinking;
      const hasSearch =
        currentModel?.is_search !== undefined
          ? !!currentModel.is_search || !!currentProviderConfig?.is_search
          : !!currentModelConfig?.is_search ||
            !!currentProviderConfig?.is_search;

      if (!hasThinking && isThinking) {
        setIsThinking(false);
        try {
          localStorage.setItem("zen-thinking-enabled", "false");
        } catch {}
      }
      if (!hasSearch && isSearch) {
        setIsSearch(false);
        try {
          localStorage.setItem("zen-search-enabled", "false");
        } catch {}
      }
    }, [
      currentModel,
      currentModelConfig,
      currentProviderConfig,
      providers,
      isThinking,
      isSearch,
      setIsThinking,
      setIsSearch,
    ]);

    // Handle auto-selection of account from cache once providers are loaded
    React.useEffect(() => {
      if (
        pendingAccountIdRef.current &&
        providers.length > 0 &&
        !currentAccount?.email &&
        currentModel?.providerId
      ) {
        const fetchAccountsForProvider = async () => {
          try {
            const response = await fetch(
              `${apiUrl}/v1/accounts?page=1&limit=50&provider_id=${currentModel.providerId}`,
            );
            const result = await response.json();
            if (result.success && result.data?.accounts) {
              const acc = result.data.accounts.find(
                (a: any) => a.id === pendingAccountIdRef.current,
              );
              if (acc) {
                setCurrentAccount({ id: acc.id, email: acc.email });
                pendingAccountIdRef.current = null; // Mark as resolved
              }
            }
          } catch (error) {
            // ignore
          }
        };
        fetchAccountsForProvider();
      }
    }, [providers, currentModel, currentAccount, apiUrl, setCurrentAccount]);

    // 🔍 TRACK PROPS CHANGES - Tìm nguyên nhân re-render
    const prevPropsRef = React.useRef<any>({});
    React.useEffect(() => {
      const prev = prevPropsRef.current;
      const changes: string[] = [];

      if (prev.message !== message)
        changes.push(
          `message (${prev.message?.length || 0} → ${message.length})`,
        );
      if (prev.messages !== messages)
        changes.push(
          `messages (${prev.messages?.length || 0} → ${messages.length})`,
        );
      if (prev.responseRanges !== responseRanges)
        changes.push(
          `responseRanges (${prev.responseRanges?.length || 0} → ${responseRanges.length})`,
        );
      if (prev.conversationFileStats !== conversationFileStats)
        changes.push("conversationFileStats");
      if (prev.isProcessing !== isProcessing)
        changes.push(`isProcessing (${isProcessing})`);
      if (prev.isStreaming !== isStreaming)
        changes.push(`isStreaming (${isStreaming})`);
      if (prev.currentModel !== currentModel) changes.push("currentModel");
      if (prev.currentAccount !== currentAccount)
        changes.push("currentAccount");
      if (prev.handleTextareaChange !== handleTextareaChange)
        changes.push("handleTextareaChange [FUNCTION]");
      if (prev.handleKeyDown !== handleKeyDown)
        changes.push("handleKeyDown [FUNCTION]");
      if (prev.handleSend !== handleSend) changes.push("handleSend [FUNCTION]");
      if (prev.onModelSwitch !== onModelSwitch)
        changes.push("onModelSwitch [FUNCTION]");

      prevPropsRef.current = {
        message,
        messages,
        responseRanges,
        conversationFileStats,
        isProcessing,
        isStreaming,
        currentModel,
        currentAccount,
        handleTextareaChange,
        handleKeyDown,
        handleSend,
        onModelSwitch,
      };

      const renderTime = performance.now() - renderStartTime;
      if (renderTime > 16) {
        // Lag nếu > 1 frame (60fps)
        console.warn(
          `[MessageInput] ⚠️ Slow render: ${renderTime.toFixed(2)}ms`,
        );
      }
    });

    return (
      <div
        style={{
          padding: "var(--spacing-md) var(--spacing-lg)",
          backgroundColor: "var(--secondary-bg)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            borderRadius: "var(--border-radius)",
            border: !isConnected
              ? "1px solid var(--vscode-errorForeground, #f44336)"
              : "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            transition: "border 0.3s ease",
            marginTop:
              !isConversationStarted ||
              (isConnected && isElaraMismatch) ||
              isConversationStarted
                ? "24px"
                : "0px", // Space for badges/DiffSummaryBar sticking up
          }}
        >
          {/* 🆕 HOME PANEL BADGE (Stuck to Border) - Only when !isConversationStarted */}
          {!isConversationStarted && (
            <div
              onClick={() => {
                if (providers.length === 0) fetchProviders();
                setShowModelDrawer((v) => !v);
              }}
              style={{
                position: "absolute",
                bottom: !isConnected ? "calc(100% + 2px)" : "100%",
                left: "8px",
                backgroundColor: "var(--input-bg)",
                color: "var(--primary-text)",
                padding: "5px 10px",
                fontSize: "11px",
                fontWeight: 600,
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottomLeftRadius: "0",
                borderBottomRightRadius: "0",
                border: "1px solid var(--border-color)",
                borderBottom: !isConnected
                  ? "1px solid var(--border-color)"
                  : "none",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                boxShadow: "0 -2px 6px rgba(0,0,0,0.1)",
                transition: "all 0.2s ease",
                marginBottom: isConnected ? "-1px" : "0", // avoid inheriting red border when disconnected
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--input-bg)";
              }}
              title="Click to select Model and Account"
            >
              {displayModel ? (
                <>
                  {displayModel.favicon ? (
                    <img
                      src={displayModel.favicon}
                      alt="favicon"
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "2px",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span
                      className="codicon codicon-server-process"
                      style={{ fontSize: "12px" }}
                    />
                  )}
                  {displayModel.providerId}/{displayModel.id}
                  {displayAccount?.email && (
                    <span
                      style={{
                        opacity: 0.8,
                        fontStyle: "italic",
                        marginLeft: "2px",
                      }}
                    >
                      {displayAccount.email}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span
                    className="codicon codicon-server-process"
                    style={{ fontSize: "12px" }}
                  />
                  Select Model
                </>
              )}
            </div>
          )}

          {/* 🆕 CHAT PANEL DIFF SUMMARY BAR (Stuck to Border) - Only when isConversationStarted */}
          {isConversationStarted && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "98%",
                zIndex: 20,
              }}
            >
              <DiffSummaryBar
                totalChanges={conversationFileStats?.totalFiles || 0}
                addedLines={conversationFileStats?.totalAdditions || 0}
                removedLines={conversationFileStats?.totalDeletions || 0}
                onClick={onOpenGitStatus}
                onReviewClick={onReviewClick}
                onRevert={onRevertConversation}
                responseRange={responseRange}
                responseRanges={responseRanges}
                autoScrollPaused={autoScrollPaused}
                scrollToBottom={scrollToBottom}
              />
            </div>
          )}
          {showModelDrawer && (
            <ModelAccountDrawer
              isOpen={showModelDrawer}
              onClose={() => setShowModelDrawer(false)}
              providers={providers}
              apiUrl={apiUrl}
              onSelect={(selected) => {
                const prov = providers.find(
                  (p: any) => p.provider_id === selected.providerId,
                );
                const modelObj = prov?.models?.find(
                  (m: any) => m.id === selected.modelId,
                );
                let faviconUrl = "";
                if (prov?.website) {
                  try {
                    faviconUrl = `${new URL(prov.website).origin}/favicon.ico`;
                  } catch {}
                }

                const newModel = {
                  ...selected,
                  id: selected.modelId,
                  name: modelObj?.name || selected.modelId,
                  favicon: faviconUrl,
                  is_thinking: modelObj?.is_thinking ?? false,
                  is_search: modelObj?.is_search ?? false,
                  is_upload: modelObj?.is_upload ?? false,
                  is_memory: modelObj?.is_memory ?? prov?.is_memory ?? false,
                };

                const newAccount = {
                  id: selected.accountId,
                  email: selected.email,
                };

                if (isModelSwitchMode) {
                  // Switch mode: show confirmation dialog
                  setPendingModelSwitch({
                    model: newModel,
                    account: newAccount,
                  });
                  setShowModelDrawer(false);
                  setIsModelSwitchMode(false); // Reset flag
                } else {
                  // Normal mode: apply immediately
                  setCurrentModel(newModel);
                  setCurrentAccount(newAccount);

                  // Fetch memory state from server
                  const fetchMemoryState = async () => {
                    try {
                      const response = await fetch(
                        `${apiUrl}/v1/accounts/${selected.accountId}/memory`,
                      );
                      const result = await response.json();
                      if (result.success && result.data) {
                        setIsMemory(result.data.is_memory_enabled);
                        // Sync to localStorage
                        localStorage.setItem(
                          "zen-memory-enabled",
                          String(result.data.is_memory_enabled),
                        );
                      }
                    } catch (error) {
                      console.error("Failed to fetch memory state:", error);
                    }
                  };
                  fetchMemoryState();
                  setShowModelDrawer(false);
                }
              }}
            />
          )}

          {/* Model Switch Confirmation Dialog */}
          {pendingModelSwitch && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10001,
              }}
              onClick={() => setPendingModelSwitch(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: "var(--vscode-editor-background)",
                  border: "1px solid var(--vscode-widget-border)",
                  borderRadius: "8px",
                  padding: "20px",
                  maxWidth: "400px",
                  width: "90%",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    marginBottom: "12px",
                    color: "var(--vscode-foreground)",
                  }}
                >
                  Switch Model?
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    marginBottom: "16px",
                    color: "var(--vscode-descriptionForeground)",
                    lineHeight: 1.5,
                  }}
                >
                  You're about to switch to:
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      backgroundColor: "var(--vscode-input-background)",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                    }}
                  >
                    <strong>
                      {pendingModelSwitch.model.providerId}/
                      {pendingModelSwitch.model.id}
                    </strong>
                    {pendingModelSwitch.account.email && (
                      <div style={{ marginTop: "4px", opacity: 0.8 }}>
                        {pendingModelSwitch.account.email}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setPendingModelSwitch(null)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      border: "1px solid var(--vscode-widget-border)",
                      backgroundColor: "transparent",
                      color: "var(--vscode-foreground)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--vscode-list-hoverBackground)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Prepare context data from current range
                      const currentRange = responseRanges.find(
                        (r) => r.isCurrent,
                      );

                      // Extract user messages from current range
                      const userMessagesInRange: Array<{
                        content: string;
                        responseNumber: number;
                      }> = [];
                      if (currentRange) {
                        // Find user messages in the current response range
                        let responseCount = 0;
                        for (const msg of messages) {
                          if (msg.role === "assistant") {
                            responseCount++;
                          }
                          if (
                            msg.role === "user" &&
                            responseCount >= currentRange.start - 1 &&
                            responseCount <= currentRange.end
                          ) {
                            userMessagesInRange.push({
                              content: msg.content,
                              responseNumber: responseCount,
                            });
                          }
                        }
                      }

                      const contextData = {
                        fileChanges: currentRange
                          ? Array.from(currentRange.fileChanges.entries()).map(
                              ([path, stats]) => ({
                                path,
                                additions: stats.additions,
                                deletions: stats.deletions,
                              }),
                            )
                          : [],
                        userMessages: userMessagesInRange,
                      };

                      // Call parent handler
                      if (onModelSwitch) {
                        onModelSwitch(
                          pendingModelSwitch.model,
                          pendingModelSwitch.account,
                          contextData,
                        );
                      }

                      // Apply model switch
                      setCurrentModel(pendingModelSwitch.model);
                      setCurrentAccount(pendingModelSwitch.account);

                      // Clear pending
                      setPendingModelSwitch(null);
                    }}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: "var(--vscode-button-background)",
                      color: "var(--vscode-button-foreground)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--vscode-button-hoverBackground)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--vscode-button-background)";
                    }}
                  >
                    Confirm Switch
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Browser session warning - bottom right inside MessageInput */}
          {showBrowserWarning && currentModel?.providerId === "zai-browser" && (
            <div
              onClick={isLaunchingBrowser ? undefined : onLaunchBrowserSession}
              style={{
                position: "absolute",
                top: "100%",
                right: "8px",
                backgroundColor: "rgba(251, 146, 60, 0.15)",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 500,
                borderBottomLeftRadius: "8px",
                borderBottomRightRadius: "8px",
                border: "1px solid rgba(251, 146, 60, 0.3)",
                borderTop: "none",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: isLaunchingBrowser ? "not-allowed" : "pointer",
                marginTop: "-1px",
                opacity: isLaunchingBrowser ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLaunchingBrowser) {
                  e.currentTarget.style.backgroundColor =
                    "rgba(251, 146, 60, 0.25)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(251, 146, 60, 0.15)";
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 500 }}>
                {isLaunchingBrowser
                  ? "Launching browser session..."
                  : "Browser session not ready. Click here"}
              </span>
            </div>
          )}
          <div
            style={{
              position: "relative",
              backgroundColor: "var(--input-bg)",
              borderTopLeftRadius: "var(--border-radius)",
              borderTopRightRadius: "var(--border-radius)",
              padding: "12px",
            }}
          >
            <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: var(--scrollbar-thumb);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: var(--scrollbar-thumb-hover);
          }
        `}</style>

            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  // Only send if not history mode, connected, not loading, not processing
                  if (
                    !isHistoryMode &&
                    isConnected &&
                    !isLoadingCache &&
                    !isProcessing
                  ) {
                    handleSend(currentModel, currentAccount);
                  }
                } else {
                  handleKeyDown(e);
                }
              }}
              onPaste={(e) => {
                if (!supportsUpload && e.clipboardData.files.length > 0) {
                  console.warn(
                    "[Zen Log] MessageInput onPaste: Upload is not supported, preventing paste.",
                  );
                  e.preventDefault();
                  // Optional: Show toast "Upload not supported by this provider"
                  return;
                }
                handlePaste(e);
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => {
                if (!supportsUpload) {
                  e.preventDefault();
                  return;
                }
                handleDrop(e);
              }}
              onFocus={(e) => {
                e.target.style.border = "none";
                e.target.style.boxShadow = "none";
              }}
              placeholder={
                isHistoryMode
                  ? "History mode - enter a search query"
                  : !isConnected
                    ? "Connecting to backend..."
                    : isLoadingCache
                      ? "Loading cache..."
                      : isProcessing
                        ? "Processing..."
                        : "Message @agent (Alt+@)"
              }
              disabled={false}
              rows={1}
              style={{
                width: "100%",
                minHeight: "24px",
                maxHeight: "240px",
                border: "none",
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                fontSize: "var(--font-size-sm)",
                backgroundColor: "transparent",
                color: "var(--primary-text)",
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                opacity: 1,
                cursor: "text",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Bottom Part: Toolbar */}
          <div
            style={{
              backgroundColor: "var(--input-bg)",
              borderBottomLeftRadius: "var(--border-radius)",
              borderBottomRightRadius: "var(--border-radius)",
              padding: "8px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {/* Left Icons */}
            <div
              style={{
                display: "flex",
                gap: "var(--spacing-xs)",
                alignItems: "center",
              }}
            >
              <div
                onClick={() => {
                  // Use the file input ref from parent
                  if (fileInputRef?.current) {
                    // Store textOnly flag on the input element for the change handler to use
                    (fileInputRef.current as any).dataset.textOnly =
                      String(!supportsUpload);
                    fileInputRef.current.click();
                  } else {
                    // Fallback: use handleFileSelect
                    handleFileSelect();
                  }
                }}
                onMouseEnter={() => setIsPlusHovered(true)}
                onMouseLeave={() => setIsPlusHovered(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "22px",
                  width: "22px",
                  boxSizing: "border-box",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  border: "1px solid rgba(128, 128, 128, 0.2)",
                  background: isPlusHovered
                    ? "rgba(128, 128, 128, 0.2)"
                    : "rgba(128, 128, 128, 0.12)",
                  color: "var(--vscode-foreground)",
                  opacity: isPlusHovered ? 0.9 : 0.7,
                }}
                title={
                  supportsUpload ? "Attach files" : "Attach text files only"
                }
              >
                <PlusIcon />
              </div>

              {/* Git Status Button */}
              {onGitPullRequest && (
                <div
                  onClick={() => {
                    if (!isGitLoading && !isProcessing && !isGitStatusVisible) {
                      onGitPullRequest();
                    }
                  }}
                  onMouseEnter={() => setIsGitHovered(true)}
                  onMouseLeave={() => setIsGitHovered(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "22px",
                    width: "22px",
                    boxSizing: "border-box",
                    borderRadius: "4px",
                    cursor:
                      isGitLoading || isProcessing || isGitStatusVisible
                        ? "default"
                        : "pointer",
                    transition: "all 0.2s ease-in-out",
                    border: "1px solid rgba(128, 128, 128, 0.2)",
                    background:
                      isGitHovered &&
                      !isGitLoading &&
                      !isProcessing &&
                      !isGitStatusVisible
                        ? "rgba(128, 128, 128, 0.2)"
                        : "rgba(128, 128, 128, 0.12)",
                    color:
                      isGitLoading || isProcessing || isGitStatusVisible
                        ? "var(--vscode-descriptionForeground, #8c8c8c)"
                        : "var(--vscode-foreground)",
                    opacity:
                      isGitHovered &&
                      !isGitLoading &&
                      !isProcessing &&
                      !isGitStatusVisible
                        ? 0.9
                        : isGitLoading || isProcessing || isGitStatusVisible
                          ? 0.5
                          : 0.7,
                  }}
                  title={
                    isGitStatusVisible
                      ? "Git Status đang hiển thị"
                      : isGitLoading
                        ? "Đang kiểm tra git status..."
                        : isProcessing
                          ? "Đang xử lý task, vui lòng đợi..."
                          : "Git Status - Kiểm tra thay đổi đã staged"
                  }
                >
                  <GitPullRequestArrow size={16} />
                </div>
              )}

              {/* Context Compression Button */}
              {showCompressButton && (
                <CompressButton
                  onClick={() => {}}
                  title="Context Compression - Compress conversation history"
                  currentModel={currentModel}
                  currentAccount={currentAccount}
                  providers={providers}
                  apiUrl={apiUrl}
                  onModelAccountSelect={(model, account) => {
                    // Open model selection drawer when null is passed
                    if (model === null && account === null) {
                      if (providers.length === 0) fetchProviders();
                      setShowModelDrawer(true);
                    }
                  }}
                  onSwitchModelRequest={() => {
                    // Open ModelAccountDrawer for model switch
                    setIsModelSwitchMode(true); // Mark as switch mode
                    if (providers.length === 0) fetchProviders();
                    setShowModelDrawer(true);
                  }}
                />
              )}

              {/* Global Tool Permission */}
              <GlobalPermissionButton />

              {/* Thinking Toggle */}
              {showThinkingButton && (
                <ThinkingButton
                  isOn={isThinking}
                  onClick={toggleThinking}
                  title="Toggle AI Thinking Process"
                />
              )}

              {/* Search Toggle */}
              {showSearchButton && (
                <SearchButton
                  isOn={isSearch}
                  onClick={toggleSearch}
                  title="Toggle Web Search Grounding"
                />
              )}

              {/* Memory Toggle */}
              {showMemoryButton && (
                <MemoryButton
                  isOn={isMemory}
                  onClick={toggleMemory}
                  title="Toggle Memory Reference (Saved memories & chat history)"
                />
              )}
            </div>

            {/* Right Icons */}
            <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
              {/* Send / Stop Button */}
              {isConnected && (
                <div
                  style={{
                    cursor:
                      isHistoryMode || isLoadingCache
                        ? "not-allowed"
                        : isStreaming || isProcessing
                          ? "pointer"
                          : message.trim() || uploadedFiles.length > 0
                            ? "pointer"
                            : "default",
                    padding: "var(--spacing-xs)",
                    borderRadius: "var(--border-radius)",
                    transition: "background-color 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      isHistoryMode || isLoadingCache
                        ? "var(--secondary-text)"
                        : isStreaming || isProcessing
                          ? "var(--vscode-errorForeground, #f44336)" // Red color for stop
                          : message.trim() || uploadedFiles.length > 0
                            ? "var(--accent-text)"
                            : "var(--secondary-text)",
                    pointerEvents:
                      isHistoryMode || isLoadingCache ? "none" : "auto",
                  }}
                  onClick={() => {
                    if ((isStreaming || isProcessing) && onStopGeneration) {
                      // Stop generation
                      onStopGeneration();
                      return;
                    }

                    if (!currentModel) {
                      console.warn(
                        "[Zen] MessageInput send: no model selected, aborting",
                      );
                      return;
                    }
                    handleSend(currentModel, currentAccount);
                  }}
                  onMouseEnter={(e) => {
                    if (
                      isStreaming ||
                      isProcessing ||
                      message.trim() ||
                      uploadedFiles.length > 0
                    ) {
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  title={
                    isStreaming || isProcessing
                      ? "Stop Generation"
                      : "Send Message"
                  }
                >
                  {isStreaming || isProcessing ? (
                    <X size={16} strokeWidth={2.5} />
                  ) : (
                    <SendIcon />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Language Badge - HomePanel only */}
          {!isConversationStarted &&
            isConnected &&
            !isElaraMismatch &&
            LANGUAGES.some(
              (l: { code: string }) => l.code === preferredLanguage,
            ) && (
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  backgroundColor: "var(--vscode-badge-background)",
                  color: "var(--vscode-badge-foreground)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  zIndex: 5,
                  opacity: 0.8,
                  pointerEvents: "none",
                }}
              >
                <span>
                  {LANGUAGES.find((l: any) => l.code === preferredLanguage)
                    ?.flag || "🇺🇸"}{" "}
                  {preferredLanguage.toUpperCase()}
                </span>
              </div>
            )}

          {/* Health / Elara Badges (Stuck to Border) */}
          {isConnected && isElaraMismatch && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                right: "8px",
                backgroundColor: "rgba(255, 152, 0, 0.1)",
                color: "var(--vscode-editorWarning-foreground, #ff9800)",
                padding: "4px 12px",
                fontSize: "11px",
                fontWeight: 600,
                borderTopLeftRadius: "var(--border-radius)",
                borderTopRightRadius: "var(--border-radius)",
                borderBottomLeftRadius: "0",
                borderBottomRightRadius: "0",
                border: "1px solid rgba(255, 152, 0, 0.2)",
                borderBottom: "none",
                cursor: "pointer",
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: "0 -2px 4px rgba(0,0,0,0.1)",
                marginBottom: "-1px",
              }}
              onClick={() => {
                const vscodeApi = (window as any).vscodeApi;
                if (vscodeApi) {
                  vscodeApi.postMessage({
                    command: "openExternal",
                    url: "https://github.com/KhanhRomVN/Elara",
                  });
                }
              }}
            >
              Elara Version Mismatch
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default MessageInput;
