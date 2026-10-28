/**
 * ------------------------------------------------------------------
 * ChatRoom Types
 * ------------------------------------------------------------------
 * Type definitions for the shared chat room.
 *
 * Main types:
 * - ChatUser     : Room member
 * - ChatMessage  : A single message (with optional reply)
 * - ChatRoomInfo : Room info
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────
export type UserRole = "owner" | "admin" | "member";

export interface ChatUser {
  id: string;
  name: string;
  role: UserRole;
  /** CSS color, uses VSCode theme variables */
  color: string;
  /** ISO 3166-1 alpha-2 */
  country?: string;
  /** Image data URL */
  avatar?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
}

export interface ChatRoomInfo {
  id: string;
  name: string;
  topic: string;
}

export interface ChatProfile {
  userId: string;
  name: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  /** Image data URL (the image itself is stored, not a file path) */
  avatar?: string;
}