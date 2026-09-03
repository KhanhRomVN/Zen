/**
 * ------------------------------------------------------------------
 * Open Conversation Folder Handler
 * ------------------------------------------------------------------
 * Mở thư mục chứa file hội thoại trong OS file manager.
 *
 * Main functions:
 * - handleOpenConversationFolder() : Mở thư mục chứa file hội thoại trong OS
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

// ─── Class ──────────────────────────────────────────────────────────────
export class OpenConversationFolderHandler {
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  public async handleOpenConversationFolder(message: any) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const { conversationId } = message;
      if (!conversationId) return;
      const folderPath = path.join(
        this.getProjectContextDir(workspaceFolder.uri.fsPath),
        conversationId,
      );
      await fs.promises.mkdir(folderPath, { recursive: true });
      await vscode.commands.executeCommand(
        "revealFileInOS",
        vscode.Uri.file(folderPath),
      );
    } catch (e) {}
  }
}
