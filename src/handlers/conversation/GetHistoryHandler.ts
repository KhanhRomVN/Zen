/**
 * ------------------------------------------------------------------
 * Get History Handler
 * ------------------------------------------------------------------
 * Trả về danh sách lịch sử hội thoại (đã sắp xếp theo thời gian),
 * kèm giới hạn 30 file JSON.
 *
 * Main functions:
 * - handleGetHistory()   : Trả về danh sách lịch sử hội thoại (sắp xếp theo thời gian)
 * - enforceHistoryLimit() : Giới hạn số lượng file JSON (tối đa 30), xóa file cũ nhất
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ── Services ──
import { PathService } from "../../services/PathService";

// ── Storage ──
import { GlobalStorageManager } from "../../storage/GlobalStorageManager";

// ── Utils ──
import { migrateAllConversationsInDir } from "../../utils/conversationMigration";

// ─── Class ──────────────────────────────────────────────────────────────
export class GetHistoryHandler {
  private pathService: PathService;

  constructor(private storageManager?: GlobalStorageManager) {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  public async handleGetHistory(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await fs.promises.mkdir(projectContextDir, { recursive: true });

      // Migrate tất cả file .json cũ sang cấu trúc folder mới (lazy batch)
      await migrateAllConversationsInDir(workspaceFolder.uri.fsPath);

      await this.enforceHistoryLimit(projectContextDir);

      // Sau migrate, tất cả conversations nằm trong sub-folder
      // Quét các folder con để tìm {conversationId}/{conversationId}.json
      const entries = await fs.promises.readdir(projectContextDir, {
        withFileTypes: true,
      });

      const history = [];
      let loggedFirst = false;

      // Helper: trích xuất providerId/modelId từ messages
      const extractModelInfo = (messages: any[]): {
        providerId?: string;
        modelId?: string;
      } => {
        const assistantMsg = messages.find(
          (m: any) =>
            m.role === "assistant" && (m.modelId || m.providerId),
        );
        return {
          providerId: assistantMsg?.providerId,
          modelId: assistantMsg?.modelId,
        };
      };

      for (const entry of entries) {
        // Cấu trúc mới: sub-folder {conversationId}/{conversationId}.json
        if (entry.isDirectory()) {
          const conversationId = entry.name;
          const jsonPath = path.join(
            projectContextDir,
            conversationId,
            `${conversationId}.json`,
          );
          if (!fs.existsSync(jsonPath)) continue;
          try {
            const content = await fs.promises.readFile(jsonPath, "utf-8");
            const data = JSON.parse(content);
            if (!Array.isArray(data) && data.metadata) {
              if (!loggedFirst) loggedFirst = true;
              const modelInfo = extractModelInfo(data.messages || []);
              history.push({
                ...data.metadata,
                id: conversationId,
                messageCount: data.messages?.length || 0,
                providerId: modelInfo.providerId,
                modelId: modelInfo.modelId,
              });
            } else if (Array.isArray(data) && data.length > 0) {
              const userMessages = data.filter((m: any) => m.role === "user");
              const lastUserMsg =
                [...userMessages]
                  .reverse()
                  .find((m: any) => m.content?.includes("<user-message>")) ||
                userMessages[userMessages.length - 1] ||
                data[0];
              let rawTitle = lastUserMsg.content || "";
              const titleMatch =
                rawTitle.match(
                  /## User Message\n<user-message>\n([\s\S]*?)\n<\/user-message>/,
                ) || rawTitle.match(/## User Message\n```\n([\s\S]*?)\n```/);
              if (titleMatch) rawTitle = titleMatch[1];
              const title = rawTitle.replace(/\n/g, " ").trim().substring(0, 100);
              const modelInfo = extractModelInfo(data);
              history.push({
                id: conversationId,
                title,
                timestamp: data[data.length - 1].timestamp || Date.now(),
                lastModified: data[data.length - 1].timestamp || Date.now(),
                preview: title,
                messageCount: data.length,
                totalRequests: userMessages.length,
                totalTokenUsage: data.reduce(
                  (sum: number, m: any) => sum + (m.token_usage || 0),
                  0,
                ),
                providerId: modelInfo.providerId,
                modelId: modelInfo.modelId,
              });
            }
          } catch {}
        }
      }
      history.sort((a, b) => {
        const timeA = new Date(a.lastModified || a.timestamp).getTime();
        const timeB = new Date(b.lastModified || b.timestamp).getTime();
        return timeB - timeA;
      });
      webviewView.webview.postMessage({
        command: "historyResult",
        requestId: message.requestId,
        history,
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "historyResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }

  public async enforceHistoryLimit(projectContextDir: string) {
    try {
      const entries = await fs.promises.readdir(projectContextDir, {
        withFileTypes: true,
      });

      // Chỉ đếm sub-folders (cấu trúc mới) — file .json cũ đã được migrate
      const convFolders: { name: string; mtime: number }[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const jsonPath = path.join(
            projectContextDir,
            entry.name,
            `${entry.name}.json`,
          );
          if (!fs.existsSync(jsonPath)) continue;
          try {
            const stats = await fs.promises.stat(jsonPath);
            convFolders.push({ name: entry.name, mtime: stats.mtimeMs });
          } catch {}
        }
      }

      if (convFolders.length <= 30) return;

      convFolders.sort((a, b) => b.mtime - a.mtime);

      const toDelete = convFolders.slice(30);
      for (const item of toDelete) {
        const folderPath = path.join(projectContextDir, item.name);
        await fs.promises
          .rm(folderPath, { recursive: true, force: true })
          .catch(() => {});
      }
    } catch (err) {}
  }
}
