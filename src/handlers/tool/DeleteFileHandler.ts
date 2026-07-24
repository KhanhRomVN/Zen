/**
 *? Usage:
 *    Xóa file trong workspace, có tạo checkpoint trước khi xóa.
 *
 *? Function:
 *    handleDeleteFile(): Xóa file, có tạo checkpoint trước khi xóa.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";

export class DeleteFileHandler {
  public async handleDeleteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path;
      if (!filePath) throw new Error("'file_path' is required");
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);
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