import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { FileLockManager } from "../../../managers/FileLockManager";
import { CheckpointManager } from "../../../managers/CheckpointManager";

export class ConversationStateHandler {
  constructor(private fileLockManager: FileLockManager) {}

  public getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  public getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }

  public async handleSaveConversationState(message: any) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const {
        conversationId,
        messages,
        backendConversationId,
        toolOutputs,
        singleLineReviewActions,
        conversationFileStats,
        metadata,
      } = message;

      if (!conversationId) return;

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await fs.promises.mkdir(projectContextDir, { recursive: true });
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      const release = await this.fileLockManager.acquire(logPath);
      try {
        const data: any = {
          messages: messages || [],
          backendConversationId,
          metadata,
        };

        if (toolOutputs && Object.keys(toolOutputs).length > 0) {
          data.toolOutputs = toolOutputs;
        }
        if (
          singleLineReviewActions &&
          Object.keys(singleLineReviewActions).length > 0
        ) {
          data.singleLineReviewActions = singleLineReviewActions;
        }
        if (conversationFileStats) {
          data.conversationFileStats = conversationFileStats;
        }

        await fs.promises.writeFile(logPath, JSON.stringify(data, null, 2));
      } finally {
        release();
      }
    } catch (e) {
      console.error(
        "[ConversationStateHandler] handleSaveConversationState error:",
        e,
      );
    }
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

        // Support both formats: plain array [...], or object { messages: [...] }
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

        // Preserve the original object format { messages: [...], ... }
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

  public async handleRollbackConversationLog(message: any) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const { conversationId, keepCount } = message;
      const logPath = path.join(
        this.getProjectContextDir(workspaceFolder.uri.fsPath),
        `${conversationId}.json`,
      );
      const content = JSON.parse(await fs.promises.readFile(logPath, "utf-8"));
      if (Array.isArray(content)) {
        const newContent = content.slice(0, keepCount);
        await fs.promises.writeFile(
          logPath,
          JSON.stringify(newContent, null, 2),
        );
      }
    } catch {}
  }
}
