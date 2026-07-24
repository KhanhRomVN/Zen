/**
 *? Usage:
 *    Xóa file JSON + thư mục của một cuộc hội thoại.
 *
 *? Function:
 *    handleDeleteConversation(): Xóa file JSON + thư mục của một cuộc hội thoại.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// SERVICES
import { PathService } from "../../services/PathService";

export class DeleteConversationHandler {
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  public async handleDeleteConversation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const logPath = path.join(
        projectContextDir,
        `${message.conversationId}.json`,
      );
      const backupPath = path.join(projectContextDir, message.conversationId);

      await fs.promises.unlink(logPath).catch(() => {});
      await fs.promises
        .rm(backupPath, { recursive: true, force: true })
        .catch(() => {});

      webviewView.webview.postMessage({
        command: "deleteConversationResult",
        requestId: message.requestId,
        conversationId: message.conversationId,
        success: true,
      });
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        webviewView.webview.postMessage({
          command: "deleteConversationResult",
          requestId: message.requestId,
          error: String(error),
          success: false,
        });
      } else {
        webviewView.webview.postMessage({
          command: "deleteConversationResult",
          requestId: message.requestId,
          conversationId: message.conversationId,
          success: true,
        });
      }
    }
  }
}