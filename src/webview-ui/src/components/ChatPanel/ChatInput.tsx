import React, { useState, useRef, useEffect } from "react";

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState(3);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MIN_ROWS = 3;
  const MAX_ROWS = 10;

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setMessage(textarea.value);

    // Tính toán số dòng dựa trên chiều cao nội dung
    textarea.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
    const padding =
      parseInt(getComputedStyle(textarea).paddingTop) +
      parseInt(getComputedStyle(textarea).paddingBottom);

    const contentHeight = textarea.scrollHeight - padding;
    const calculatedRows = Math.floor(contentHeight / lineHeight);

    // Giới hạn số dòng trong khoảng MIN_ROWS đến MAX_ROWS
    const newRows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, calculatedRows));
    setRows(newRows);
    textarea.style.height = "auto";
    textarea.style.height = `${newRows * lineHeight + padding}px`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      console.log("Sending message:", message);
      setMessage("");
      setRows(MIN_ROWS);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${
          MIN_ROWS *
            parseInt(getComputedStyle(textareaRef.current).lineHeight) +
          parseInt(getComputedStyle(textareaRef.current).paddingTop) +
          parseInt(getComputedStyle(textareaRef.current).paddingBottom)
        }px`;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Icon send component
  const SendIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        cursor: "pointer",
        color: "var(--accent-text)",
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = "var(--button-primary-hover)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent-text)")}
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );

  return (
    <form
      className="chat-input-form"
      onSubmit={handleSubmit}
      style={{
        position: "relative",
        width: "100%",
        padding: "var(--spacing-md) var(--spacing-lg)",
        backgroundColor: "var(--secondary-bg)",
      }}
    >
      <div style={{ position: "relative" }}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={rows}
          placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
          style={{
            width: "100%",
            minHeight: `${MIN_ROWS * 20}px`,
            maxHeight: `${MAX_ROWS * 20}px`,
            resize: "none",
            padding:
              "var(--spacing-md) var(--spacing-lg) 40px var(--spacing-lg)", // Thêm padding dưới cho icon
            backgroundColor: "var(--input-bg-light, var(--input-bg))",
            color: "var(--primary-text)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius)",
            fontSize: "var(--font-size-md)",
            lineHeight: "1.5",
            fontFamily: "inherit",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--accent-text)";
            e.target.style.boxShadow = "0 0 0 1px var(--accent-text)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border-color)";
            e.target.style.boxShadow = "none";
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "12px",
            bottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
          }}
          onClick={handleSubmit}
        >
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              opacity: message.trim() ? 1 : 0.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <SendIcon />
          </div>
        </div>
      </div>
    </form>
  );
};

export default ChatInput;
