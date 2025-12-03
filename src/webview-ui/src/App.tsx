import React, { useState } from "react";
import ChatPanel from "./components/ChatPanel/ChatPanel";
import "./styles/components/chat.css";

const App: React.FC = () => {
  return (
    <div className="app-container">
      <ChatPanel />
    </div>
  );
};

export default App;
