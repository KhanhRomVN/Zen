/**
 * ------------------------------------------------------------------
 * MessageComposer
 * ------------------------------------------------------------------
 * Ô nhập tin nhắn: tự giãn chiều cao, Enter để gửi, Shift+Enter xuống
 * dòng. Style đồng bộ với components/MessageInput.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";
import { getCountryFlagEmoji } from "../../../utils/countryFlags";
import type { ChatProfile } from "../types";


// ─── Constants ──────────────────────────────────────────────────────────
const MAX_HEIGHT = 240;

// ─── Interfaces ─────────────────────────────────────────────────────────
interface MessageComposerProps {
  roomName: string;
  profile: ChatProfile;
  onSend: (content: string) => void;
  onEditProfile: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────
const MessageComposer: React.FC<MessageComposerProps> = ({
  roomName,
  profile,
  onSend,
  onEditProfile,
}) => {
  // ── State ──
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0;

  // ── Effects ──
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  // ── Callbacks ──
  const submit = () => {
    if (!canSend) return;
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // ── Render ──
  return (
    <div style={{ padding: "0 16px 14px", flexShrink: 0 }}>
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--input-bg)",
          borderTopLeftRadius: "var(--border-radius)",
          borderTopRightRadius: "var(--border-radius)",
          padding: "12px",
        }}
      >
        <div
          onClick={onEditProfile}
          style={{
            position: "absolute",
            bottom: "100%",
            left: "8px",
            backgroundColor: "var(--input-bg)",
            color: "var(--primary-text)",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            boxShadow: "0 -2px 6px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--input-bg)";
          }}
          title="Click to edit your name and country"
        >
          <span>{getCountryFlagEmoji(profile.country)}</span>
          <span>{profile.name}</span>
        </div>
        <textarea
          ref={textareaRef}
          className="cr-input"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${roomName}`}
          style={{
            display: "block",
            width: "100%",
            minHeight: "24px",
            maxHeight: `${MAX_HEIGHT}px`,
            border: "none",
            outline: "none",
            resize: "none",
            padding: 0,
            fontFamily: "inherit",
            fontSize: "var(--font-size-sm)",
            backgroundColor: "transparent",
            color: "var(--primary-text)",
            overflowX: "hidden",
            overflowY: "hidden",
            wordBreak: "break-word",
            boxSizing: "border-box",
          }}
        />
      </div>

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
        <span
          style={{
            fontSize: 11,
            color: "var(--vscode-descriptionForeground)",
          }}
        >
          Enter to send · Shift+Enter for new line
        </span>
      </div>

      <style>{`
        .cr-input::placeholder { color: var(--vscode-input-placeholderForeground, rgba(204, 204, 204, 0.5)); }
      `}</style>
    </div>
  );
};

export default MessageComposer;