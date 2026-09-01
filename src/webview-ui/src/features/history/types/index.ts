/**
 * ------------------------------------------------------------------
 * History Types
 * ------------------------------------------------------------------
 * Định nghĩa kiểu dữ liệu cho tính năng lịch sử hội thoại.

 * Main types:
 * - ConversationItem : Thông tin một hội thoại trong lịch sử
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────
export interface ConversationItem {
  id: string;
  tabId: number;
  folderPath: string | null;
  title: string;
  lastModified: number;
  messageCount: number;
  preview: string;
  containerName?: string;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok" | "claude";
  createdAt: number;
  timestamp?: number;
  totalRequests: number;
  totalTokenUsage: number;
  size?: number; // Size in bytes
  totalTasks?: number;
  completedTasks?: number;
  uniqueTaskCount?: number;
}