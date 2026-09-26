/**
 * ------------------------------------------------------------------
 * Delete Conversation Handler
 * ------------------------------------------------------------------
 * Xóa file JSON + thư mục của một cuộc hội thoại.
 *
 * Main functions:
 * - handleDeleteConversation() : Xóa file JSON + thư mục của một cuộc hội thoại
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

// ── Utils ──
import { migrateConversationIfNeeded } from "../../utils/conversationMigration";

// ─── Class ──────────────────────────────────────────────────────────────
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

      // Migrate lazy trước khi xóa để đảm bảo file cũ cũng được dọn
      await migrateConversationIfNeeded(
        workspaceFolder.uri.fsPath,
        message.conversationId,
      );

      // Xóa toàn bộ folder conversation (chứa .json + checkpoints + replace_history)
      const convDir = this.pathService.getConversationDir(
        workspaceFolder.uri.fsPath,
        message.conversationId,
      );
      await fs.promises
        .rm(convDir, { recursive: true, force: true })
        .catch(() => {});

      // Xóa file .json cũ nếu migrate thất bại và vẫn còn ở ngoài
      const legacyPath = this.pathService.getLegacyConversationJsonPath(
        workspaceFolder.uri.fsPath,
        message.conversationId,
      );
      await fs.promises.unlink(legacyPath).catch(() => {});

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
