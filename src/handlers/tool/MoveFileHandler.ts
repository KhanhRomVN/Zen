/**
 *? Usage:
 *    Di chuyển file giữa các thư mục trong workspace, hỗ trợ cross-device, có security check và checkpoint.
 *
 *? Function:
 *    handleMoveFile(): Di chuyển file giữa các thư mục, hỗ trợ cross-device, có security check.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// AGENT
import { SecurityValidator } from "../../utils/security";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";

// SERVICES
import { LoggerService } from "../../services/LoggerService";

export class MoveFileHandler {
  public async handleMoveFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const sourcePath = message.file_path || message.source_path;
      const targetFolderPath = message.target_folder_path;
      if (!sourcePath) throw new Error("'file_path' is required");
      if (!targetFolderPath)
        throw new Error("'target_folder_path' is required");

      const absSource = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(workspaceFolder.uri.fsPath, sourcePath);
      const absTargetFolder = path.isAbsolute(targetFolderPath)
        ? targetFolderPath
        : path.join(workspaceFolder.uri.fsPath, targetFolderPath);

      const sc = SecurityValidator.validatePath(absSource, false);
      if (!sc.safe)
        throw new Error(sc.reason || "Security validation failed for source");
      const tc = SecurityValidator.validatePath(absTargetFolder, true);
      if (!tc.safe)
        throw new Error(tc.reason || "Security validation failed for target");

      try {
        await fs.promises.stat(absSource);
      } catch {
        throw new Error(`Source file not found: '${sourcePath}'`);
      }
      await fs.promises.mkdir(absTargetFolder, { recursive: true });
      const fileName = path.basename(absSource);
      const absDest = path.join(absTargetFolder, fileName);

      const cpm = CheckpointManager.getInstance();
      if (message.conversationId)
        cpm.setActiveConversationId(message.conversationId);
      await cpm.createCheckpoint(absSource, "delete");

      try {
        await fs.promises.rename(absSource, absDest);
      } catch (renameErr: any) {
        if (renameErr.code === "EXDEV") {
          await fs.promises.copyFile(absSource, absDest);
          await fs.promises.unlink(absSource);
        } else throw renameErr;
      }
      const newPath = path
        .relative(workspaceFolder.uri.fsPath, absDest)
        .replace(/\\/g, "/");
      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        success: true,
        newPath,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}
