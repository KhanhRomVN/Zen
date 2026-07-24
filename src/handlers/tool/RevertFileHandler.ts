/**
 *? Usage:
 *    Revert file về checkpoint hoặc replace history version. Có tích hợp snapshot, diagnostics.
 *
 *? Function:
 *    handleRevertFile(): Revert file về checkpoint hoặc replace history version.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// AGENT
import { SecurityValidator } from "../../utils/security";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";
import { SnapshotManager } from "../../managers/SnapshotManager";

// SERVICES
import { LoggerService } from "../../services/LoggerService";

export class RevertFileHandler {
  private getDiagnosticsForFile(uri: vscode.Uri): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
    return vscode.languages
      .getDiagnostics(uri)
      .filter(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map((d) => ({
        severity:
          d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning",
        message: d.message,
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        source: d.source,
        code: d.code
          ? typeof d.code === "object"
            ? d.code.value
            : d.code
          : undefined,
      }));
  }

  public async handleRevertFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path || message.path;
      const version = message.version;

      if (!filePath) throw new Error("'file_path' is required");
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);
      const pc = SecurityValidator.validatePath(absPath, false);
      if (!pc.safe) throw new Error(pc.reason || "Security validation failed");
      try {
        await fs.promises.stat(absPath);
      } catch {
        throw new Error(`File not found: '${filePath}'`);
      }

      const beforeContent = await fs.promises.readFile(absPath, "utf-8");

      let afterContent: string;

      if (version !== undefined && version !== null && message.conversationId) {
        const historyManager = ReplaceInFileHistoryManager.getInstance();
        historyManager.setActiveConversationId(message.conversationId);

        const history = await historyManager.getHistoryVersion(
          absPath,
          parseInt(version, 10),
        );
        if (!history) {
          throw new Error(
            `No history found for version ${version} of file '${filePath}'`,
          );
        }

        afterContent = history.fullContent;

        await fs.promises.writeFile(absPath, afterContent, "utf-8");

        await historyManager.deleteVersionsAfter(
          absPath,
          parseInt(version, 10),
        );
      } else {
        const cpm = CheckpointManager.getInstance();
        const checkpoint = await cpm.getLastCheckpointForFile(absPath);

        if (!checkpoint) {
          throw new Error(
            `No checkpoint found for file '${filePath}'. Cannot revert.`,
          );
        }

        if (checkpoint.content === null) {
          throw new Error(
            `Checkpoint for '${filePath}' has no content. Cannot revert.`,
          );
        }

        afterContent = checkpoint.content;
        await fs.promises.writeFile(absPath, afterContent, "utf-8");
      }

      const fileUri = vscode.Uri.file(absPath);

      if (beforeContent === afterContent) {
        logger.warn(
          `[DEBUG revert_file] WARNING: Content unchanged after revert!`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const diagnostics = this.getDiagnosticsForFile(fileUri);

      if (message.conversationId && message.actionId) {
        await SnapshotManager.getInstance().saveSnapshot(
          message.conversationId,
          message.actionId,
          absPath,
          "revert",
          beforeContent,
          afterContent,
        );
      }
      webviewView.webview.postMessage({
        command: "revertFileResult",
        requestId: message.requestId,
        success: true,
        path: filePath,
        oldContent: beforeContent,
        newContent: afterContent,
        diagnostics,
      });
    } catch (e: any) {
      logger.error(`[DEBUG revert_file] Error: ${e.message}`);
      webviewView.webview.postMessage({
        command: "revertFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}
