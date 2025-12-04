import React from "react";

const ChatBody: React.FC = () => {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--spacing-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          color: "var(--secondary-text)",
          fontSize: "var(--font-size-sm)",
          padding: "var(--spacing-xl)",
        }}
      >
        <div
          style={{
            fontSize: "var(--font-size-xxl)",
            marginBottom: "var(--spacing-md)",
          }}
        >
          💬
        </div>
        <p>No messages yet</p>
        <p
          style={{
            fontSize: "var(--font-size-xs)",
            marginTop: "var(--spacing-xs)",
          }}
        >
          Start a conversation by typing a message below
        </p>
      </div>
    </div>
  );
};

export default ChatBody;
