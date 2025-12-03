import React from "react";
import ChatPanel from "./components/ChatPanel/ChatPanel";
import "./styles/components/chat.css";
import { useVSCodeTheme } from "./hooks/useVSCodeTheme";

const App: React.FC = () => {
  // Sử dụng VS Code theme
  useVSCodeTheme();

  return (
    <div className="app-container">
      <ChatPanel />
    </div>
  );
};

export default App;
