import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { FileLockManager } from "../../managers/FileLockManager";
import { CheckpointManager } from "../../managers/CheckpointManager";
import { PathService } from "../../services/PathService";

export class ConversationStateHandler {
  private pathService: PathService;

  constructor(private fileLockManager: FileLockManager) {
    // Debounce timer for save operations
    this._saveDebounceTimers = new Map();
    this._pendingSaveData = new Map();
    this.pathService = PathService.getInstance();
  }

  private _saveDebounceTimers: Map<string, NodeJS.Timeout>;
  private _pendingSaveData: Map<
    string,
    {
      messages: any[];
      backendConversationId?: string;
      toolOutputs?: Record<string, any>;
      singleLineReviewActions?: Record<string, any>;
      conversationFileStats?: any;
      metadata?: any;
    }
  >;
  private readonly _DEBOUNCE_DELAY = 1000; // 1 second

  public getContextRoot(): string {
    return this.pathService.getContextRoot();
  }

  public getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
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

      // Update pending data for this conversation
      this._pendingSaveData.set(conversationId, {
        messages: messages || [],
        backendConversationId,
        toolOutputs,
        singleLineReviewActions,
        conversationFileStats,
        metadata,
      });

      // Clear existing timer
      if (this._saveDebounceTimers.has(conversationId)) {
        clearTimeout(this._saveDebounceTimers.get(conversationId)!);
      }

      // Set new timer
      this._saveDebounceTimers.set(
        conversationId,
        setTimeout(() => {
          this._flushSave(conversationId, workspaceFolder.uri.fsPath);
        }, this._DEBOUNCE_DELAY),
      );
    } catch (e) {
      console.error(
        "[ConversationStateHandler] handleSaveConversationState error:",
        e,
      );
    }
  }

  private async _flushSave(conversationId: string, workspaceFsPath: string) {
    const pending = this._pendingSaveData.get(conversationId);
    if (!pending) return;

    try {
      const projectContextDir = this.getProjectContextDir(workspaceFsPath);
      await fs.promises.mkdir(projectContextDir, { recursive: true });
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      // Read existing data to compare
      let existingData: any = null;
      try {
        const content = await fs.promises.readFile(logPath, "utf-8");
        existingData = JSON.parse(content);
      } catch {
        // File doesn't exist or invalid JSON
      }

      const data: any = {
        messages: pending.messages || [],
        backendConversationId: pending.backendConversationId,
        metadata: pending.metadata,
      };

      if (pending.toolOutputs && Object.keys(pending.toolOutputs).length > 0) {
        data.toolOutputs = pending.toolOutputs;
      }
      if (
        pending.singleLineReviewActions &&
        Object.keys(pending.singleLineReviewActions).length > 0
      ) {
        data.singleLineReviewActions = pending.singleLineReviewActions;
      }
      if (pending.conversationFileStats) {
        data.conversationFileStats = pending.conversationFileStats;
      }

      // Only write if data has changed
      const newJson = JSON.stringify(data, null, 2);
      const existingJson = existingData
        ? JSON.stringify(existingData, null, 2)
        : null;

      if (newJson !== existingJson) {
        const release = await this.fileLockManager.acquire(logPath);
        try {
          await fs.promises.writeFile(logPath, newJson);
        } finally {
          release();
        }
      }

      this._pendingSaveData.delete(conversationId);
      this._saveDebounceTimers.delete(conversationId);
    } catch (e) {
      console.error("[ConversationStateHandler] _flushSave error:", e);
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
