/**
 * ------------------------------------------------------------------
 * Delete File Handler
 * ------------------------------------------------------------------
 * Xóa file trong workspace, có tạo checkpoint trước khi xóa.
 *
 * Main functions:
 * - handleDeleteFile() : Xóa file, có tạo checkpoint trước khi xóa
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ── Managers ──
import { CheckpointManager } from "../../managers/CheckpointManager";

// ── Security ──
import { SecurityValidator } from "../../utils/security";

// ─── Class ──────────────────────────────────────────────────────────────
export class DeleteFileHandler {
  public async handleDeleteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace");
      }
      const filePath = message.file_path;
      if (!filePath) {
        throw new Error("'file_path' is required");
      }
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);

      // FIX P0 Security: validate path before delete (isWrite=true because delete = mutation)
      const pc = SecurityValidator.validatePath(absPath, true);
      if (!pc.safe) {
        throw new Error(pc.reason || "Security validation failed");
      }

      await CheckpointManager.getInstance().createCheckpoint(absPath, "delete");
      await fs.promises.unlink(absPath);
      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        success: true,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}
