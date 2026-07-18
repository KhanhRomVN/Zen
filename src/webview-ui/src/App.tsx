import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatPanel from "./features/chat";
import HomePanel from "./features/home";
import HistoryPanel from "./features/history";
import SettingsPanel from "./features/setting";
import AccountPanel from "./features/account";
import "./styles/components/chat.css";
import { ProjectProvider } from "./context/ProjectContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BackendConnectionProvider } from "./context/BackendConnectionContext";
import { SettingsProvider } from "./context/SettingsContext";

import { extensionService } from "./services/ExtensionService";
import { ChatSession } from "./features/chat/types/chat";

// Initialize global storage API
(window as any).storage = extensionService.getStorage();

const App: React.FC = () => {
  // Notify extension host rằng React app đã mount xong
  // Extension sẽ dùng signal này để lazy-load theme (tránh block render lần đầu)
  useEffect(() => {
    extensionService.postMessage({ command: "webviewReady" });
  }, []);

  // 🆕 Clear stale state on mount
  useEffect(() => {
    try {
      // Only clear if extension just started (check timestamp)
      const lastClear = sessionStorage.getItem("zen-last-clear");
      const now = Date.now();
      if (!lastClear || now - parseInt(lastClear) > 60000) {
        // 1 minute
        sessionStorage.clear();
        sessionStorage.setItem("zen-last-clear", now.toString());
      }
    } catch (error) {
      // console.error("[App] Failed to clear stale state:", error);
    }
  }, []);

  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [currentChat, setCurrentChat] = useState<ChatSession | null>(null);
  const [previousPanel, setPreviousPanel] = useState<"tab" | "chat" | null>(
    null,
  );
  const [homeInitialValue, setHomeInitialValue] = useState("");

  const handleLoadConversation = useCallback(
    (conversationId: string, sessionId: number, folderPath: string | null) => {
      // Create a new chat session for the loaded conversation
      const newSession: ChatSession = {
        sessionId: sessionId,
        folderPath: folderPath,
        conversationId: conversationId,
        canAccept: true, // Allow input for loaded history
      };

      setCurrentChat(newSession);
      setShowHistory(false);
      setShowSettings(false);
      setPreviousPanel(null);
    },
    [],
  );

  // 🆕 Initial Message Data State
  const [initialMessageData, setInitialMessageData] = useState<{
    content: string;
    files: any[];
    model: any;
    account: any;
  } | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "showHistory":
          // Save current panel before switching
          if (currentChat) {
            setPreviousPanel("chat");
          } else {
            setPreviousPanel("tab");
          }
          setShowHistory(true);
          setShowSettings(false);
          setShowAccounts(false);
          break;
        case "showSettings":
          if (currentChat) {
            setPreviousPanel("chat");
          } else {
            setPreviousPanel("tab");
          }
          setShowSettings(true);
          setShowHistory(false);
          setShowAccounts(false);
          break;
        case "showAccounts":
          if (currentChat) {
            setPreviousPanel("chat");
          } else {
            setPreviousPanel("tab");
          }
          setShowAccounts(true);
          setShowHistory(false);
          setShowSettings(false);
          break;
        case "newChat":
          setShowHistory(false);
          setShowSettings(false);
          setShowAccounts(false);
          setCurrentChat(null);
          setPreviousPanel(null);
          setInitialMessageData(null); // Clear initial data on new chat
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentChat]);

  const handleHomeSendMessage = useCallback(
    (content: string, files: any[], model: any, account: any) => {
      setInitialMessageData({
        content,
        files,
        model,
        account,
      });
      const newSession: ChatSession = {
        sessionId: Date.now(),
        folderPath: (window as any).__zenWorkspaceFolderPath || null,
        conversationId: "", // Empty for new chat
        canAccept: true,
      };
      setCurrentChat(newSession);
      setHomeInitialValue(""); // Clear when starting fresh from Home
    },
    [],
  );

  const handleBack = useCallback((contentToReturn?: string) => {
    setCurrentChat(null);
    if (typeof contentToReturn === "string" && contentToReturn.trim()) {
      setHomeInitialValue(contentToReturn);
    } else {
      setHomeInitialValue("");
    }
  }, []);

  const handleClearInitialData = useCallback(() => {
    setInitialMessageData(null);
  }, []);

  const lastChatRef = useRef<ChatSession | null>(null);
  if (currentChat) lastChatRef.current = currentChat;

  return (
    <ThemeProvider>
      <SettingsProvider>
        <BackendConnectionProvider>
          <ProjectProvider>
            <div className="app-container">
              {!showAccounts && (
                <>
                  {currentChat && lastChatRef.current && (
                    <ChatPanel
                      currentChat={lastChatRef.current}
                      onBack={handleBack}
                      onLoadConversation={handleLoadConversation}
                      initialMessageData={initialMessageData}
                      onClearInitialData={handleClearInitialData}
                    />
                  )}
                  {!currentChat && (
                    <HomePanel
                      onSendMessage={handleHomeSendMessage}
                      onLoadConversation={handleLoadConversation}
                      initialValue={homeInitialValue}
                    />
                  )}
                </>
              )}
              <HistoryPanel
                isOpen={showHistory}
                onClose={() => {
                  setShowHistory(false);
                  setPreviousPanel(null);
                }}
                onLoadConversation={handleLoadConversation}
              />
              <SettingsPanel
                isOpen={showSettings}
                onClose={() => {
                  setShowSettings(false);
                  setPreviousPanel(null);
                }}
              />
              <AccountPanel
                isOpen={showAccounts}
                onClose={() => {
                  setShowAccounts(false);
                  setPreviousPanel(null);
                }}
              />
            </div>
          </ProjectProvider>
        </BackendConnectionProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
};

export default App;
