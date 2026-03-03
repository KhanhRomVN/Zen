import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { BackupManager } from "../../managers/BackupManager";

export class BackupHandler {
  constructor(private backupManager: BackupManager | undefined) {}

  private getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }

  public async handleStartBackupWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    try {
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await this.backupManager.startBackupFileWatcher(
        message.conversationId,
        workspaceFolder,
        webviewView,
        projectContextDir,
      );
      webviewView.webview.postMessage({
        command: "startBackupWatchResult",
        success: true,
        conversationId: message.conversationId,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "startBackupWatchResult",
        success: false,
        error: String(e),
      });
    }
  }

  public async handleStopBackupWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    try {
      this.backupManager.stopBackupFileWatcher();
      webviewView.webview.postMessage({
        command: "stopBackupWatchResult",
        success: true,
      });
    } catch (e) {}
  }

  public async handleGetBackupTimeline(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    try {
      const timeline = await this.backupManager.getTimeline(
        message.conversationId,
      );
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        for (const event of timeline) {
          event.fileExists = fs.existsSync(
            path.join(workspaceFolder.uri.fsPath, event.filePath),
          );
        }
      }
      webviewView.webview.postMessage({
        command: "backupTimelineResult",
        requestId: message.requestId,
        timeline,
        conversationId: message.conversationId,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "backupTimelineResult",
        requestId: message.requestId,
        error: String(e),
      });
    }
  }

  public async handleGetBackupSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    try {
      const content = await this.backupManager.getSnapshotContent(
        message.conversationId,
        message.snapshotPath,
      );
      webviewView.webview.postMessage({
        command: "backupSnapshotResult",
        requestId: message.requestId,
        content,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "backupSnapshotResult",
        requestId: message.requestId,
        error: String(e),
      });
    }
  }

  public async handleGetBackupBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const blacklist = await this.backupManager.getBackupBlacklist(
      workspaceFolder.uri.fsPath,
    );
    webviewView.webview.postMessage({
      command: "backupBlacklistResult",
      requestId: message.requestId,
      blacklist,
    });
  }

  public async handleAddToBackupBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    let pathToAdd = message.path;
    if (path.isAbsolute(pathToAdd))
      pathToAdd = path.relative(workspaceFolder.uri.fsPath, pathToAdd);
    await this.backupManager.addToBackupBlacklist(
      workspaceFolder.uri.fsPath,
      pathToAdd,
    );
    const blacklist = await this.backupManager.getBackupBlacklist(
      workspaceFolder.uri.fsPath,
    );
    webviewView.webview.postMessage({
      command: "backupBlacklistResult",
      requestId: message.requestId,
      blacklist,
    });
  }

  public async handleRemoveFromBackupBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    let pathToRemove = message.path;
    if (path.isAbsolute(pathToRemove))
      pathToRemove = path.relative(workspaceFolder.uri.fsPath, pathToRemove);
    await this.backupManager.removeFromBackupBlacklist(
      workspaceFolder.uri.fsPath,
      pathToRemove,
    );
    const blacklist = await this.backupManager.getBackupBlacklist(
      workspaceFolder.uri.fsPath,
    );
    webviewView.webview.postMessage({
      command: "backupBlacklistResult",
      requestId: message.requestId,
      blacklist,
    });
  }

  public async handleDeleteBackupFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this.backupManager) {
      await this.backupManager.deleteFileBackup(
        message.conversationId,
        message.filePath,
      );
      webviewView.webview.postMessage({
        command: "deleteBackupFileResult",
        success: true,
        filePath: message.filePath,
        conversationId: message.conversationId,
      });
    }
  }

  public async handleBackupBinaryFileDecision(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this.backupManager) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      await this.backupManager.setBinaryFileDecision(
        workspaceFolder.uri.fsPath,
        message.extension,
        message.allow ? "allow" : "deny",
      );
      if (!message.allow) {
        await this.backupManager.deleteByExtension(
          message.conversationId,
          message.extension,
        );
      } else {
        await this.backupManager.clearUnconfirmedByExtension(
          message.conversationId,
          message.extension,
        );
      }
      webviewView.webview.postMessage({
        command: "backupEventAdded",
        conversationId: message.conversationId,
      });
    }
  }

  public async handleRevertToSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    try {
      await this.backupManager.restoreSnapshot(
        message.conversationId,
        message.filePath,
        message.snapshotPath,
      );
      webviewView.webview.postMessage({
        command: "revertToSnapshotResult",
        success: true,
        requestId: message.requestId,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "revertToSnapshotResult",
        success: false,
        error: String(e),
        requestId: message.requestId,
      });
    }
  }

  public async handleOpenSnapshotDiffWithCurrent(message: any) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const { conversationId, fileEvent } = message;
    const { snapshotPath, filePath } = fileEvent;

    if (!snapshotPath || !filePath) return;

    const snapshotContent = await this.backupManager.getSnapshotContent(
      conversationId,
      snapshotPath,
    );
    const tmpDir = path.join(os.tmpdir(), "khanhromvn-zen-diff");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = vscode.Uri.file(
      path.join(tmpDir, path.basename(snapshotPath)),
    );
    await vscode.workspace.fs.writeFile(
      tmpFile,
      Buffer.from(snapshotContent, "utf8"),
    );
    const currentFile = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    await vscode.commands.executeCommand(
      "vscode.diff",
      tmpFile,
      currentFile,
      `Snapshot ↔ Current`,
    );
  }
}
