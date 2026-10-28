/**
 * ------------------------------------------------------------------
 * MessageBubble
 * ------------------------------------------------------------------
 * A single chat message: avatar, name and bubble.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";
import type { ChatMessage, ChatUser } from "../types";
import { getCountryFlagEmoji } from "../../../utils/countryFlags";
import UserAvatar, { ROLE_META } from "./UserAvatar";

// ─── Constants ──────────────────────────────────────────────────────────
const BORDER = "var(--vscode-widget-border, var(--vscode-panel-border))";

// ─── Helpers ────────────────────────────────────────────────────────────
export const formatTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

// ─── Interfaces ─────────────────────────────────────────────────────────
interface MessageBubbleProps {
  message: ChatMessage;
  user: ChatUser;
  isOwn: boolean;
  showHeader: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  user,
  isOwn,
  showHeader,
}) => {
  const role = user.role !== "member" ? ROLE_META[user.role] : null;
  const align = isOwn ? "flex-end" : "flex-start";
  const rowDir = isOwn ? "row-reverse" : "row";
  const radius = !showHeader
    ? 12
    : isOwn
      ? "12px 2px 12px 12px"
      : "2px 12px 12px 12px";

  return (
    <div
      className="cr-msg"
      style={{
        display: "flex",
        flexDirection: rowDir,
        gap: 10,
        alignItems: "flex-start",
        marginTop: showHeader ? 14 : 2,
      }}
    >
      <div style={{ width: 36, flexShrink: 0 }}>
        {showHeader && <UserAvatar user={user} />}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: align,
          maxWidth: "72%",
          minWidth: 0,
        }}
      >
        {showHeader && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
              flexDirection: rowDir,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--primary-text)",
              }}
            >
              {user.country && `${getCountryFlagEmoji(user.country)} `}
              {user.name}
            </span>
            {role && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "1px 5px",
                  borderRadius: 4,
                  color: role.color,
                  backgroundColor: `color-mix(in srgb, ${role.color} 15%, transparent)`,
                }}
              >
                {role.label}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                color: "var(--vscode-descriptionForeground)",
              }}
            >
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}

        <div
          title={new Date(message.timestamp).toLocaleString()}
          style={{
            padding: "8px 12px",
            borderRadius: radius,
            minWidth: 0,
            maxWidth: "100%",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: isOwn
              ? "var(--vscode-button-foreground)"
              : "var(--vscode-foreground)",
            backgroundColor: isOwn
              ? "var(--vscode-button-background)"
              : "var(--vscode-editorWidget-background)",
            border: isOwn ? "1px solid transparent" : `1px solid ${BORDER}`,
          }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;