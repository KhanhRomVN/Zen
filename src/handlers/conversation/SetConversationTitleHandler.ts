/**
 *? Usage:
 *    Cập nhật title cho conversation, lưu vào metadata.title trong file JSON.
 *
 *? Function:
 *    handleSetConversationTitle(): Cập nhật title cho conversation.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// MANAGERS
import { FileLockManager } from "../../managers/FileLockManager";

// SERVICES
import { PathService } from "../../services/PathService";

export class SetConversationTitleHandler {
  private pathService: PathService;

  constructor(private fileLockManager: FileLockManager) {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  public async handleSetConversationTitle(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");

      const { conversationId, title } = message;
      if (!conversationId) throw new Error("conversationId is required");
      if (!title || !title.trim()) throw new Error("title is required");

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      let data: any = {};
      try {
        const content = await fs.promises.readFile(logPath, "utf-8");
        data = JSON.parse(content);
      } catch (readErr) {
        // File might not exist yet — start fresh
        data = { messages: [] };
      }

      if (Array.isArray(data)) {
        // Legacy array format — wrap into object
        data = { messages: data };
      }

      if (!data.metadata) {
        data.metadata = {};
      }
      data.metadata.title = title.trim();

      const release = await this.fileLockManager.acquire(logPath);
      try {
        await fs.promises.writeFile(logPath, JSON.stringify(data, null, 2));
      } finally {
        release();
      }

      webviewView.webview.postMessage({
        command: "setConversationTitleResult",
        requestId: message.requestId,
        title: title.trim(),
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "setConversationTitleResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }
}
