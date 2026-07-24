/**
 *? Usage:
 *    Lưu trạng thái hội thoại với debounce 1s, chỉ ghi khi có thay đổi.
 *
 *? Function:
 *    handleSaveConversationState(): Lưu trạng thái hội thoại với debounce 1s, chỉ ghi khi có thay đổi.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// MANAGERS
import { FileLockManager } from "../../managers/FileLockManager";

// SERVICES
import { PathService } from "../../services/PathService";

export class SaveConversationStateHandler {
  private pathService: PathService;
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
  private readonly _DEBOUNCE_DELAY = 1000;

  constructor(private fileLockManager: FileLockManager) {
    this._saveDebounceTimers = new Map();
    this._pendingSaveData = new Map();
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
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

      this._pendingSaveData.set(conversationId, {
        messages: messages || [],
        backendConversationId,
        toolOutputs,
        singleLineReviewActions,
        conversationFileStats,
        metadata,
      });

      if (this._saveDebounceTimers.has(conversationId)) {
        clearTimeout(this._saveDebounceTimers.get(conversationId)!);
      }

      this._saveDebounceTimers.set(
        conversationId,
        setTimeout(() => {
          this._flushSave(conversationId, workspaceFolder.uri.fsPath);
        }, this._DEBOUNCE_DELAY),
      );
    } catch (e) {
      console.error(
        "[SaveConversationStateHandler] handleSaveConversationState error:",
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

      let existingData: any = null;
      try {
        const content = await fs.promises.readFile(logPath, "utf-8");
        existingData = JSON.parse(content);
      } catch {}

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
      console.error("[SaveConversationStateHandler] _flushSave error:", e);
    }
  }
}