import React, { useState } from "react";

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState("");

  return (
    <div className="chat-input-container">
      <div className="auto-approve-bar">
        <span className="auto-approve-text">
          Auto-approve: Read (all), Edit (all), All Commands, Browser, MCP
        </span>
      </div>

      <div className="chat-input-wrapper">
        <div className="input-toolbar-left">
          <button className="toolbar-btn" title="Attach">
            <span>@</span>
          </button>
          <button className="toolbar-btn" title="Add">
            <span>+</span>
          </button>
          <button className="toolbar-btn" title="Files">
            <span>📄</span>
          </button>
          <button className="toolbar-btn" title="List">
            <span>≡</span>
          </button>
        </div>

        <input
          type="text"
          className="chat-input"
          placeholder="Type your task here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div className="input-toolbar-right">
          <span className="chat-context">itellm:deepseek-chat</span>
          <button className="plan-btn">Plan</button>
          <button className="send-btn">Act</button>
        </div>
      </div>

      <div className="input-hint">
        <span>
          Type @ for context, / for slash commands & workflows, hold shift to
          drag in files/images
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
