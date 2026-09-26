/**
 * ------------------------------------------------------------------
 * Conversation Migration Utility
 * ------------------------------------------------------------------
 * Migrate cấu trúc file cũ:
 *   {projectHash}/{conversationId}.json
 * sang cấu trúc mới:
 *   {projectHash}/{conversationId}/{conversationId}.json
 *
 * Được gọi lazy (khi đọc/ghi) — không cần migration batch toàn bộ.
 * ------------------------------------------------------------------
 */

import * as fs from "fs";
import { PathService } from "../services/PathService";

const pathService = PathService.getInstance();

/**
 * Nếu file cũ tồn tại mà file mới chưa có, di chuyển file cũ vào folder mới.
 * Trả về đường dẫn JSON hiện hành sau migrate.
 */
export async function migrateConversationIfNeeded(
  workspaceFsPath: string,
  conversationId: string,
): Promise<string> {
  const newPath = pathService.getConversationJsonPath(
    workspaceFsPath,
    conversationId,
  );
  const legacyPath = pathService.getLegacyConversationJsonPath(
    workspaceFsPath,
    conversationId,
  );

  // Đã ở cấu trúc mới → không cần làm gì
  if (fs.existsSync(newPath)) {
    return newPath;
  }

  // File cũ tồn tại → migrate
  if (fs.existsSync(legacyPath)) {
    try {
      const convDir = pathService.getConversationDir(
        workspaceFsPath,
        conversationId,
      );
      await fs.promises.mkdir(convDir, { recursive: true });
      await fs.promises.rename(legacyPath, newPath);
      console.log(`[Migration] Moved legacy → new: ${conversationId}`);
      return newPath;
    } catch (err) {
      console.error(`[Migration] Failed to migrate ${conversationId}:`, err);
      // Fallback: dùng legacy path nếu migrate thất bại
      return legacyPath;
    }
  }

  // Cả hai đều không tồn tại → trả về new path (caller tự mkdir + write)
  return newPath;
}

/**
 * Migrate tất cả file .json cũ trong một projectContextDir sang cấu trúc mới.
 * Gọi một lần khi mở History panel để migrate batch.
 */
export async function migrateAllConversationsInDir(
  workspaceFsPath: string,
): Promise<void> {
  const projectContextDir = pathService.getProjectContextDir(workspaceFsPath);

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(projectContextDir, {
      withFileTypes: true,
    });
  } catch {
    return; // Thư mục chưa tồn tại
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const conversationId = entry.name.replace(".json", "");
      await migrateConversationIfNeeded(workspaceFsPath, conversationId);
    }
  }
}
