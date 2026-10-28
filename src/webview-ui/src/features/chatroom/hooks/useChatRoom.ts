/**
 * ------------------------------------------------------------------
 * useChatRoom
 * ------------------------------------------------------------------
 * Hook managing the real chat room state through Tencent Cloud Chat:
 * fetch userSig from the worker, login, join the shared group,
 * receive and send text messages.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import TencentCloudChat from "@tencentcloud/chat";
import {
  CHAT_GROUP_ID,
  CHAT_ROOM,
  TOKEN_ENDPOINT,
  USER_COLORS,
} from "../constants/config";
import type { ChatMessage, ChatProfile, ChatUser } from "../types";

// ─── Constants ──────────────────────────────────────────────────────────
const GROUP_NOT_FOUND_CODE = 10015;
const ALREADY_IN_GROUP_CODE = 10013;

const HISTORY_MAX_PAGES = 10;

// ─── Types ──────────────────────────────────────────────────────────────
export type ChatStatus = "connecting" | "ready" | "error";

interface ImMessage {
  ID: string;
  from: string;
  nick?: string;
  time: number;
  type: string;
  conversationID: string;
  payload: { text?: string };
  cloudCustomData?: string;
}

type ChatClient = ReturnType<typeof TencentCloudChat.create>;

// ─── Helpers ────────────────────────────────────────────────────────────
const pickColor = (userId: string): string => {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return USER_COLORS[hash % USER_COLORS.length];
};

const defaultNick = (userId: string): string => `User-${userId.slice(-4)}`;

// ASSUMED: country của người khác được gửi kèm mỗi tin nhắn qua cloudCustomData
const parseCountry = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw)?.country;
  } catch {
    return undefined;
  }
};

const toChatUser = (
  userId: string,
  nick?: string,
  country?: string,
): ChatUser => ({
  id: userId,
  name: nick || defaultNick(userId),
  role: "member",
  color: pickColor(userId),
  country,
});

const toChatMessage = (m: ImMessage): ChatMessage => ({
  id: m.ID,
  userId: m.from,
  content: m.payload.text ?? "",
  timestamp: m.time * 1000,
});

const errorMessage = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : String((e as { message?: string })?.message ?? e);

// ─── Hook ───────────────────────────────────────────────────────────────
export const useChatRoom = (profile: ChatProfile) => {
  // ── State ──
  const currentUserId = profile.userId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([
    toChatUser(currentUserId, profile.name),
  ]);
  const [status, setStatus] = useState<ChatStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<ChatClient | null>(null);

  // ── Effects ──
  useEffect(() => {
    let disposed = false;
    let chat: ChatClient | null = null;

    const upsertUser = (user: ChatUser) =>
      setUsers((prev) =>
        prev.some((u) => u.id === user.id) ? prev : [...prev, user],
      );

    const onMessages = (event: { data: ImMessage[] }) => {
      const incoming = event.data.filter(
        (m) =>
          m.type === TencentCloudChat.TYPES.MSG_TEXT &&
          m.conversationID === `GROUP${CHAT_GROUP_ID}`,
      );
      if (incoming.length === 0) return;
      incoming.forEach((m) =>
        upsertUser(toChatUser(m.from, m.nick, parseCountry(m.cloudCustomData))),
      );
      setMessages((prev) => [...prev, ...incoming.map(toChatMessage)]);
    };

    const joinRoom = async (client: ChatClient) => {
      await client.updateMyProfile({
        nick: profile.name,
        location: profile.country, // ASSUMED: country lưu ở trường location của Tencent profile
      });
      try {
        await client.joinGroup({
          groupID: CHAT_GROUP_ID,
          type: TencentCloudChat.TYPES.GRP_PUBLIC,
        });
      } catch (e) {
        const code = (e as { code?: number }).code;
        if (code === ALREADY_IN_GROUP_CODE) return;
        if (code !== GROUP_NOT_FOUND_CODE) throw e;
        await client.createGroup({
          type: TencentCloudChat.TYPES.GRP_PUBLIC,
          name: CHAT_ROOM.name,
          groupID: CHAT_GROUP_ID,
          joinOption: TencentCloudChat.TYPES.JOIN_OPTIONS_FREE_ACCESS,
        });
      }
    };

    const loadHistory = async (client: ChatClient) => {
      const history: ImMessage[] = [];
      let nextReqMessageID: string | undefined;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const res = await client.getMessageList({
          conversationID: `GROUP${CHAT_GROUP_ID}`,
          nextReqMessageID,
        });
        history.unshift(...(res.data.messageList as ImMessage[]));
        if (res.data.isCompleted) break;
        nextReqMessageID = res.data.nextReqMessageID;
      }
      const texts = history.filter(
        (m) => m.type === TencentCloudChat.TYPES.MSG_TEXT,
      );
      texts.forEach((m) =>
        upsertUser(toChatUser(m.from, m.nick, parseCountry(m.cloudCustomData))),
      );
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [
          ...texts.filter((m) => !known.has(m.ID)).map(toChatMessage),
          ...prev,
        ];
      });
    };

    const connect = async () => {
      try {
        const res = await fetch(TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId }),
        });
        if (!res.ok) throw new Error(`Token request failed (${res.status})`);
        const { sdkAppId, userSig } = await res.json();
        if (disposed) return;

        chat = TencentCloudChat.create({ SDKAppID: sdkAppId });
        chat.setLogLevel(1);
        chatRef.current = chat;
        chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, onMessages);
        chat.on(TencentCloudChat.EVENT.SDK_READY, async () => {
          try {
            await joinRoom(chat as ChatClient);
            await loadHistory(chat as ChatClient);
            if (!disposed) setStatus("ready");
          } catch (e) {
            if (disposed) return;
            setStatus("error");
            setError(errorMessage(e));
          }
        });
        await chat.login({ userID: currentUserId, userSig });
      } catch (e) {
        if (disposed) return;
        setStatus("error");
        setError(errorMessage(e));
      }
    };

    connect();

    return () => {
      disposed = true;
      chatRef.current = null;
      if (chat) {
        chat.off(TencentCloudChat.EVENT.MESSAGE_RECEIVED, onMessages);
        void chat.destroy();
      }
    };
  }, [currentUserId, profile.name, profile.country]);

  // ── Callbacks ──
  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      const chat = chatRef.current;
      if (!text || !chat || status !== "ready") return;
      try {
        const msg = chat.createTextMessage({
          to: CHAT_GROUP_ID,
          conversationType: TencentCloudChat.TYPES.CONV_GROUP,
          payload: { text },
          cloudCustomData: JSON.stringify({ country: profile.country }),
        });
        const res = await chat.sendMessage(msg);
        const sent = res.data.message as ImMessage;
        setMessages((prev) => [
          ...prev,
          { ...toChatMessage(sent), userId: currentUserId },
        ]);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [currentUserId, status, profile.country],
  );

  return {
    messages,
    users,
    currentUserId,
    status,
    error,
    sendMessage,
  };
};