/**
 * ------------------------------------------------------------------
 * ChatRoom Config
 * ------------------------------------------------------------------
 * Static config for the shared chat room (Tencent Cloud Chat).
 *
 * Main exports:
 * - TOKEN_ENDPOINT : Cloudflare Worker issuing userSig
 * - CHAT_GROUP_ID  : Public group id of the shared room
 * - CHAT_ROOM      : Room info
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import type { ChatRoomInfo } from "../types";

// ─── Constants ──────────────────────────────────────────────────────────
export const TOKEN_ENDPOINT = "https://zen.khanhromvn.workers.dev/";

export const PRESENCE_ENDPOINT = "wss://zen-presence.khanhromvn.workers.dev/";

export const CHAT_GROUP_ID = "zen_general_public"; // ASSUMED: ID mới vì "zen_general" đã tồn tại dưới dạng AVChatRoom, không thể đổi loại nhóm

export const PROFILE_STORAGE_KEY = "zen_chatroom_profile";

export const CHAT_ROOM: ChatRoomInfo = {
  id: CHAT_GROUP_ID,
  name: "general",
  topic: "General chat for the Zen community",
};

export const USER_COLORS: string[] = [
  "var(--vscode-charts-blue)",
  "var(--vscode-charts-orange)",
  "var(--vscode-charts-purple)",
  "var(--vscode-charts-green)",
  "var(--vscode-charts-red)",
  "var(--vscode-charts-yellow)",
];