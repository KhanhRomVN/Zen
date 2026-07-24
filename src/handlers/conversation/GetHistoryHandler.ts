/**
 *? Usage:
 *    Trả về danh sách lịch sử hội thoại (đã sắp xếp theo thời gian), kèm giới hạn 30 file JSON.
 *
 *? Function:
 *    handleGetHistory()  : Trả về danh sách lịch sử hội thoại (đã sắp xếp theo thời gian).
 *    enforceHistoryLimit(): Giới hạn số lượng file JSON (tối đa 30), xóa file cũ nhất.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// SERVICES
import { PathService } from "../../services/PathService";

// STORAGE
import { GlobalStorageManager } from "../../storage/GlobalStorageManager";

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
      await this.enforceHistoryLimit(projectContextDir);
      const entries = await fs.promises.readdir(projectContextDir, {
        withFileTypes: true,
      });

      const history = [];
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          try {
            const content = await fs.promises.readFile(
              path.join(projectContextDir, entry.name),
              "utf-8",
            );
            const data = JSON.parse(content);
            const conversationId = entry.name.replace(".json", "");
            if (!Array.isArray(data) && data.metadata) {
              history.push({
                ...data.metadata,
                id: conversationId,
                messageCount: data.messages?.length || 0,
              });
            } else if (Array.isArray(data) && data.length > 0) {
              const userMessages = data.filter((m: any) => m.role === "user");
              const lastUserMsg =
                [...userMessages]
                  .reverse()
                  .find((m: any) =>
                    m.content?.includes("<zen-user-content>"),
                  ) ||
                userMessages[userMessages.length - 1] ||
                data[0];
              let rawTitle = lastUserMsg.content || "";
              const titleMatch =
                rawTitle.match(
                  /## User Message\n<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
                ) || rawTitle.match(/## User Message\n```\n([\s\S]*?)\n```/);
              if (titleMatch) rawTitle = titleMatch[1];
              const title = rawTitle
                .replace(/\n/g, " ")
                .trim()
                .substring(0, 100);

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
      const files = await fs.promises.readdir(projectContextDir);
      const jsonFiles: { name: string; mtime: number }[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(projectContextDir, file);
          try {
            const stats = await fs.promises.stat(filePath);
            jsonFiles.push({ name: file, mtime: stats.mtimeMs });
          } catch {}
        }
      }

      if (jsonFiles.length <= 30) return;

      jsonFiles.sort((a, b) => b.mtime - a.mtime);

      const toDelete = jsonFiles.slice(30);
      for (const item of toDelete) {
        const logPath = path.join(projectContextDir, item.name);
        const conversationId = item.name.replace(".json", "");
        const folderPath = path.join(projectContextDir, conversationId);

        await fs.promises.unlink(logPath).catch(() => {});
        await fs.promises
          .rm(folderPath, { recursive: true, force: true })
          .catch(() => {});
      }
    } catch (err) {}
  }
}