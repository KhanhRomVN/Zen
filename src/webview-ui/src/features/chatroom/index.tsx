/**
 * ------------------------------------------------------------------
 * ChatRoomPanel
 * ------------------------------------------------------------------
 * The single shared chat room for all users (Tencent Cloud Chat).
 *
 * Main features:
 * - Messages grouped by day, consecutive messages by the same user merged
 * - Connection status banner
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useEffect, useMemo, useRef, useState } from "react";

// ── UI ──
import { X } from "lucide-react";

// ── Components ──
import ChatRoomSkeleton from "./components/ChatRoomSkeleton";
import MessageBubble from "./components/MessageBubble";
import MessageComposer from "./components/MessageComposer";
import ProfileDrawer from "./components/ProfileDrawer";

// ── Hooks ──
import { useChatRoom } from "./hooks/useChatRoom";
import { useChatProfile } from "./hooks/useChatProfile";

// ── Types ──
import type { ChatProfile } from "./types";

// ── Constants ──
import { CHAT_ROOM } from "./constants/config";

// ─── Constants ──────────────────────────────────────────────────────────
const GROUP_GAP_MS = 5 * 60_000;

// ─── Helpers ────────────────────────────────────────────────────────────
const getDayLabel = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
};

// ─── Interfaces ─────────────────────────────────────────────────────────
interface ChatRoomPanelProps {
  onClose?: () => void;
}

interface ChatRoomViewProps extends ChatRoomPanelProps {
  profile: ChatProfile;
  onSaveProfile: (value: {
    name: string;
    country: string;
    avatar?: string;
  }) => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────
const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  onClose,
  profile,
  onSaveProfile,
}) => {
  // ── State ──
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const imagesUri = (window as any).__zenImagesUri;

  // ── Store ──
  const { messages, users, currentUserId, status, error, sendMessage } =
    useChatRoom(profile);

  // ── Derived ──
  const usersById = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u]));
    const me = map.get(currentUserId);
    if (me) {
      map.set(currentUserId, {
        ...me,
        name: profile.name,
        country: profile.country,
        avatar: profile.avatar,
      });
    }
    return map;
  }, [users, currentUserId, profile]);

  // ── Effects ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // ── Render ──
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        color: "var(--vscode-foreground)",
        backgroundColor: "var(--vscode-sideBar-background)",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 48,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
          borderBottom: "1px solid var(--vscode-panel-border)",
          backgroundColor: "var(--vscode-sideBar-background)",
        }}
      >
        <img
          src={`${imagesUri}/icon.png`}
          alt="Zen Logo"
          style={{ width: 28, height: 28, flexShrink: 0, objectFit: "contain" }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
            {CHAT_ROOM.name}
          </div>
          <div
            style={{
              fontSize: 11,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            {CHAT_ROOM.topic}
          </div>
        </div>
        {onClose && (
          <button
            className="cr-icon-btn"
            onClick={onClose}
            title="Close"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              background: "transparent",
              color: "var(--vscode-foreground)",
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Status */}
      {(status !== "ready" || error) && (
        <div
          style={{
            flexShrink: 0,
            padding: "6px 16px",
            fontSize: 11,
            color:
              status === "error" || error
                ? "var(--vscode-errorForeground)"
                : "var(--vscode-descriptionForeground)",
          }}
        >
          {status === "error" || error
            ? `Connection error: ${error}`
            : "Connecting..."}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 12px" }}>
          {status === "connecting" && messages.length === 0 ? (
            <ChatRoomSkeleton />
          ) : (
            messages.map((m, i) => {
            const user = usersById.get(m.userId);
            if (!user) return null;
            const prev = messages[i - 1];
            const newDay =
              !prev ||
              new Date(prev.timestamp).toDateString() !==
                new Date(m.timestamp).toDateString();
            const showHeader =
              newDay ||
              prev.userId !== m.userId ||
              m.timestamp - prev.timestamp > GROUP_GAP_MS;
            return (
              <React.Fragment key={m.id}>
                {newDay && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "16px 0 4px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--vscode-descriptionForeground)",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        backgroundColor: "var(--vscode-panel-border)",
                      }}
                    />
                    {getDayLabel(m.timestamp)}
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        backgroundColor: "var(--vscode-panel-border)",
                      }}
                    />
                  </div>
                )}
                <MessageBubble
                  message={m}
                  user={user}
                  isOwn={m.userId === currentUserId}
                  showHeader={showHeader}
                />
              </React.Fragment>
            );
          }))}
          <div ref={bottomRef} />
        </div>

        <MessageComposer
          roomName={CHAT_ROOM.name}
          profile={profile}
          onSend={sendMessage}
          onEditProfile={() => setShowProfileDrawer((v) => !v)}
        />

        {showProfileDrawer && (
          <ProfileDrawer
            initialName={profile.name}
            initialCountry={profile.country}
            initialAvatar={profile.avatar}
            onClose={() => setShowProfileDrawer(false)}
            onSubmit={async (value) => {
              await onSaveProfile(value);
              setShowProfileDrawer(false);
            }}
          />
        )}
      </div>

      <style>{`
        .cr-actions { opacity: 0; transition: opacity 0.12s ease; }
        .cr-msg:hover .cr-actions { opacity: 1; }
        .cr-icon-btn:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.2)) !important; }
        .cr-composer:focus-within { border-color: var(--vscode-focusBorder) !important; }
      `}</style>
    </div>
  );
};

const ChatRoomPanel: React.FC<ChatRoomPanelProps> = ({ onClose }) => {
  // ── Store ──
  const { profile, loading, saveProfile } = useChatProfile();

  // ── Render ──
  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: "8px 16px 12px",
          boxSizing: "border-box",
          backgroundColor: "var(--vscode-sideBar-background)",
        }}
      >
        <ChatRoomSkeleton />
      </div>
    );
  }
  if (!profile) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "var(--vscode-sideBar-background)",
        }}
      >
        <ProfileDrawer onSubmit={saveProfile} onClose={onClose} />
      </div>
    );
  }
  return (
    <ChatRoomView
      profile={profile}
      onClose={onClose}
      onSaveProfile={saveProfile}
    />
  );
};

export default ChatRoomPanel;