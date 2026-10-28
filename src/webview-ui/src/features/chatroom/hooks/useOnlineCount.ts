/**
 * ------------------------------------------------------------------
 * useOnlineCount
 * ------------------------------------------------------------------
 * Hook chia sẻ (singleton) lấy số người đang online dùng Zen qua
 * WebSocket tới worker zen-presence (Cloudflare Durable Object).
 *
 * Main features:
 * - Một kết nối WebSocket dùng chung cho mọi badge
 * - Gửi ping định kỳ, tự reconnect khi mất kết nối
 * - Tự ngắt khi không còn badge nào
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { extensionService } from "../../../services/ExtensionService";
import {
  PRESENCE_ENDPOINT,
  PRESENCE_ID_KEY,
  PROFILE_STORAGE_KEY,
} from "../constants/config";

// ─── Types ──────────────────────────────────────────────────────────────
type Listener = (count: number | null) => void;

// ─── Constants ──────────────────────────────────────────────────────────
const PING_MS = 30_000;
const RECONNECT_MS = 5_000;

// ─── Module state ───────────────────────────────────────────────────────
const listeners = new Set<Listener>();
let current: number | null = null;
let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────
const emit = (count: number | null) => {
  current = count;
  listeners.forEach((l) => l(count));
};

const clearTimers = () => {
  if (pingTimer) clearInterval(pingTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  pingTimer = null;
  reconnectTimer = null;
};

const getPresenceId = async (): Promise<string> => {
  const storage = extensionService.getStorage();
  try {
    const profileRaw = await storage.get(PROFILE_STORAGE_KEY);
    const userId = profileRaw ? JSON.parse(profileRaw.value)?.userId : null;
    if (userId) return userId;
    const saved = await storage.get(PRESENCE_ID_KEY);
    if (saved?.value) return saved.value;
    const id = `zen-${uuidv4()}`;
    await storage.set(PRESENCE_ID_KEY, id);
    return id;
  } catch {
    return `zen-${uuidv4()}`;
  }
};

const connect = async () => {
  const uid = await getPresenceId();
  if (listeners.size === 0 || socket) return;
  const ws = new WebSocket(
    `${PRESENCE_ENDPOINT}?uid=${encodeURIComponent(uid)}`,
  );
  socket = ws;

  ws.onopen = () => {
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, PING_MS);
  };

  ws.onmessage = (event) => {
    if (event.data === "pong") return;
    try {
      const { online } = JSON.parse(event.data);
      if (typeof online === "number") emit(online);
    } catch {}
  };

  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    clearTimers();
    if (listeners.size > 0) reconnectTimer = setTimeout(connect, RECONNECT_MS);
  };
};

const stop = () => {
  clearTimers();
  const ws = socket;
  socket = null;
  ws?.close();
};

// ─── Hook ───────────────────────────────────────────────────────────────
export const useOnlineCount = () => {
  const [count, setCount] = useState<number | null>(current);

  useEffect(() => {
    listeners.add(setCount);
    if (listeners.size === 1) connect();
    return () => {
      listeners.delete(setCount);
      if (listeners.size === 0) stop();
    };
  }, []);

  return count;
};