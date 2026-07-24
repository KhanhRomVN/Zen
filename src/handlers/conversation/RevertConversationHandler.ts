/**
 *? Usage:
 *    Khôi phục hội thoại về trước một message, kèm checkpoint để có thể undo.
 *
 *? Function:
 *    handleRevertConversation(): Khôi phục hội thoại về trước một message, kèm checkpoint.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";
import { FileLockManager } from "../../managers/FileLockManager";

// SERVICES
import { PathService } from "../../services/PathService";

export class RevertConversationHandler {
  private pathService: PathService;

  constructor(private fileLockManager: FileLockManager) {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  public async handleRevertConversation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.warn("[REVERT-DEBUG] No workspace folder found");
        return;
      }
      const { conversationId, messageId, timestamp } = message;
      if (!conversationId || !messageId) {
        console.warn("[REVERT-DEBUG] Missing conversationId or messageId", {
          conversationId,
          messageId,
        });
        return;
      }

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      if (!fs.existsSync(logPath)) {
        console.error("[REVERT-DEBUG] Log file not found:", logPath);
        throw new Error(`Log file not found: ${logPath}`);
      }

      const release = await this.fileLockManager.acquire(logPath);
      try {
        const fileData = await fs.promises.readFile(logPath, "utf-8");

        let parsed;
        try {
          parsed = JSON.parse(fileData);
        } catch (parseErr: any) {
          console.error("[REVERT-DEBUG] JSON parse error:", parseErr.message);
          throw new Error(`Failed to parse log file: ${parseErr.message}`);
        }

        let content: any[];
        if (Array.isArray(parsed)) {
          content = parsed;
        } else if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.messages)
        ) {
          content = parsed.messages;
        } else {
          console.error(
            "[REVERT-DEBUG] Invalid conversation log format, type:",
            typeof parsed,
            "value:",
            JSON.stringify(parsed).substring(0, 100),
          );
          throw new Error("Invalid conversation log format");
        }

        if (content.length === 0) {
          webviewView.webview.postMessage({
            command: "conversationReverted",
            conversationId,
          });
          return;
        }

        const index = content.findIndex((m: any) => m.id === messageId);
        if (index === -1) {
          console.error(
            "[REVERT-DEBUG] Message not found in history. Available IDs:",
            content.map((m: any) => m.id),
          );
          throw new Error(`Message with ID ${messageId} not found in history`);
        }

        const targetMsg = content[index];
        const revertTimestamp =
          typeof targetMsg.timestamp === "string"
            ? new Date(targetMsg.timestamp).getTime()
            : targetMsg.timestamp || timestamp;

        content = content.slice(0, index);

        if (!Array.isArray(parsed)) {
          parsed.messages = content;
        } else {
          parsed = content;
        }
        await fs.promises.writeFile(
          logPath,
          JSON.stringify(parsed, null, 2),
          "utf-8",
        );

        await CheckpointManager.getInstance().revertToCheckpoint(
          conversationId,
          revertTimestamp,
        );
      } finally {
        release();
      }

      webviewView.webview.postMessage({
        command: "conversationReverted",
        conversationId,
      });
    } catch (e: any) {
      console.error(
        "[REVERT-DEBUG] Error in handleRevertConversation:",
        e.message,
        e.stack,
      );
      webviewView.webview.postMessage({
        command: "conversationRevertedError",
        error: e.message,
      });
    }
  }
}