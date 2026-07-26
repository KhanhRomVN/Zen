import * as fs from "fs";
/**
 *? Usage:
 *    Lưu lịch sử các lần replace_in_file thành công, hỗ trợ xem và revert về version cũ.
 *
 *? Function:
 *    saveHistory()        : Lưu phiên bản mới sau mỗi lần replace.
 *    getHistoryList()     : Trả về danh sách version kèm error/warning/line count.
 *    getHistoryVersion()  : Lấy nội dung đầy đủ của một version.
 *    deleteVersionsAfter(): Xóa các version cao hơn version chỉ định (dùng khi revert).
 */
import * as crypto from "crypto";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export interface ReplaceInFileHistory {
  id: string;
  filePath: string;
  version: number;
  fullContent: string;
  errorCount: number;
  warningCount: number;
  lineCount: number;
  timestamp: number;
  messageId?: string; // Message ID that created this version
  messageTimestamp?: number; // Message timestamp for revert comparison
  responseNumber?: number; // Response number (1-based) for precise revert tracking
}

export class ReplaceInFileHistoryManager {
  private static instance: ReplaceInFileHistoryManager;
  private activeConversationId: string | null = null;

  private constructor() {}

  public static getInstance(): ReplaceInFileHistoryManager {
    if (!ReplaceInFileHistoryManager.instance) {
      ReplaceInFileHistoryManager.instance = new ReplaceInFileHistoryManager();
    }
    return ReplaceInFileHistoryManager.instance;
  }

  public setActiveConversationId(conversationId: string | null) {
    this.activeConversationId = conversationId;
  }

  private getHistoryDir(conversationId: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) throw new Error("No workspace folder open");
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolder.uri.fsPath)
      .digest("hex");
    const projectContextDir = path.join(
      os.homedir(),
      "khanhromvn-zen",
      "projects",
      hash,
    );
    return path.join(projectContextDir, conversationId, "replace_history");
  }

  /**
   * Lưu lịch sử replace_in_file thành công
   */
  public async saveHistory(
    filePath: string,
    fullContent: string,
    errorCount: number,
    warningCount: number,
    messageId?: string,
    messageTimestamp?: number,
    responseNumber?: number,
    oldContent?: string, // Add oldContent parameter for version 0 baseline
  ): Promise<void> {
    const startTime = Date.now();
    if (!this.activeConversationId) {
      console.log("[HISTORY-SAVE] No active conversation, skipping save");
      return;
    }

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      await fs.promises.mkdir(historyDir, { recursive: true });

      // Lấy version hiện tại của file này
      const versionStart = Date.now();
      const currentVersion = await this.getCurrentVersion(filePath);
      const versionDuration = Date.now() - versionStart;
      
      console.log("[HISTORY-SAVE] Current version check:", {
        filePath,
        currentVersion,
        willCreateBaseline: currentVersion === 0,
        hasOldContent: !!oldContent,
      });
      
      // Nếu đây là lần replace đầu tiên (currentVersion = 0), tạo version 0 baseline
      if (currentVersion === 0 && oldContent) {
        console.log("[HISTORY-SAVE] First replace detected, creating version 0 baseline with oldContent...");
        await this.createVersion0Baseline(filePath, oldContent);
      }
      
      const newVersion = currentVersion + 1;

      const timestamp = Date.now();
      const id = `replace_${timestamp}_${crypto.randomBytes(4).toString("hex")}`;
      const lineCount = fullContent.split("\n").length;

      console.log("[HISTORY-SAVE] Saving new version:", {
        filePath,
        version: newVersion,
        lineCount,
        contentLength: fullContent.length,
        contentPreview: fullContent.substring(0, 200),
        firstLine: fullContent.split("\n")[0],
      });

      const history: ReplaceInFileHistory = {
        id,
        filePath,
        version: newVersion,
        fullContent,
        errorCount,
        warningCount,
        lineCount,
        timestamp,
        messageId,
        messageTimestamp,
        responseNumber,
      };

      // Lưu file JSON theo pattern: {filePath_hash}_v{version}.json
      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);
      const historyFileName = `${fileHash}_v${newVersion}.json`;
      const historyFilePath = path.join(historyDir, historyFileName);

      const writeStart = Date.now();
      await fs.promises.writeFile(
        historyFilePath,
        JSON.stringify(history, null, 2),
        "utf-8",
      );
      
      console.log("[HISTORY-SAVE] ✅ Version saved successfully:", {
        filePath,
        version: newVersion,
        historyFilePath,
        fileHash,
      });
    } catch (error) {
      console.error("[HISTORY-SAVE] ❌ Error saving history:", {
        filePath,
        messageId,
        messageTimestamp,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Tạo version 0 baseline - nội dung gốc của file trước khi replace lần đầu
   */
  private async createVersion0Baseline(filePath: string, content: string): Promise<void> {
    if (!this.activeConversationId) {
      console.log("[HISTORY-BASELINE] No active conversation, skipping version 0");
      return;
    }

    try {
      console.log("[HISTORY-BASELINE] Creating version 0 for:", filePath);
      
      console.log("[HISTORY-BASELINE] Using provided content:", {
        filePath,
        contentLength: content.length,
        contentPreview: content.substring(0, 200),
        firstLine: content.split("\n")[0],
      });
      
      const historyDir = this.getHistoryDir(this.activeConversationId);
      const timestamp = Date.now();
      const id = `baseline_${timestamp}_${crypto.randomBytes(4).toString("hex")}`;
      const lineCount = content.split("\n").length;

      const baselineHistory: ReplaceInFileHistory = {
        id,
        filePath,
        version: 0,
        fullContent: content,
        errorCount: 0,
        warningCount: 0,
        lineCount,
        timestamp,
      };

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);
      const historyFileName = `${fileHash}_v0.json`;
      const historyFilePath = path.join(historyDir, historyFileName);

      await fs.promises.writeFile(
        historyFilePath,
        JSON.stringify(baselineHistory, null, 2),
        "utf-8",
      );

      console.log("[HISTORY-BASELINE] ✅ Version 0 created successfully:", {
        filePath,
        historyFilePath,
        lineCount,
        contentLength: content.length,
        fileHash,
      });
    } catch (error) {
      console.error("[HISTORY-BASELINE] ❌ Error creating version 0:", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Lấy version hiện tại cao nhất của file
   */
  public async getCurrentVersion(filePath: string): Promise<number> {
    if (!this.activeConversationId) return 0;

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) return 0;

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);

      const files = await fs.promises.readdir(historyDir);
      let maxVersion = 0;

      for (const file of files) {
        if (file.startsWith(fileHash) && file.endsWith(".json")) {
          const versionMatch = file.match(/_v(\d+)\.json$/);
          if (versionMatch) {
            const version = parseInt(versionMatch[1], 10);
            if (version > maxVersion) {
              maxVersion = version;
            }
          }
        }
      }

      return maxVersion;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Lấy danh sách lịch sử của một file
   */
  public async getHistoryList(filePath: string): Promise<
    Array<{
      version: number;
      errorCount: number;
      warningCount: number;
      lineCount: number;
    }>
  > {
    if (!this.activeConversationId) return [];

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) return [];

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);

      const files = await fs.promises.readdir(historyDir);
      const histories: Array<{
        version: number;
        errorCount: number;
        warningCount: number;
        lineCount: number;
      }> = [];

      for (const file of files) {
        if (file.startsWith(fileHash) && file.endsWith(".json")) {
          try {
            const historyFilePath = path.join(historyDir, file);
            const raw = await fs.promises.readFile(historyFilePath, "utf-8");
            const history: ReplaceInFileHistory = JSON.parse(raw);

            if (history.filePath === filePath) {
              // Calculate lineCount with multiple fallbacks for old data
              let lineCount = history.lineCount;
              if (!lineCount && history.fullContent) {
                lineCount = history.fullContent.split("\n").length;
              }
              if (!lineCount) {
                lineCount = 0; // Default for very old data without fullContent
              }

              histories.push({
                version: history.version,
                errorCount: history.errorCount,
                warningCount: history.warningCount,
                lineCount,
              });
            }
          } catch (e) {
            // Skip invalid files
          }
        }
      }

      // Sort by version ascending
      histories.sort((a, b) => a.version - b.version);

      return histories;
    } catch (error) {
      return [];
    }
  }

  /**
   * Lấy nội dung của một version cụ thể
   */
  public async getHistoryVersion(
    filePath: string,
    version: number,
  ): Promise<ReplaceInFileHistory | null> {
    if (!this.activeConversationId) {
      console.log("[HISTORY-GET] No active conversation");
      return null;
    }

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) {
        console.log("[HISTORY-GET] History directory not found:", historyDir);
        return null;
      }

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);
      const historyFileName = `${fileHash}_v${version}.json`;
      const historyFilePath = path.join(historyDir, historyFileName);

      console.log("[HISTORY-GET] Fetching version:", {
        filePath,
        version,
        fileHash,
        historyFilePath,
        exists: fs.existsSync(historyFilePath),
      });

      if (!fs.existsSync(historyFilePath)) {
        console.log("[HISTORY-GET] Version file not found:", historyFilePath);
        return null;
      }

      const raw = await fs.promises.readFile(historyFilePath, "utf-8");
      const history: ReplaceInFileHistory = JSON.parse(raw);

      console.log("[HISTORY-GET] ✅ Version fetched successfully:", {
        filePath,
        version: history.version,
        lineCount: history.lineCount,
        contentLength: history.fullContent?.length,
        contentPreview: history.fullContent?.substring(0, 200),
        firstLine: history.fullContent?.split("\n")[0],
      });

      return history;
    } catch (error) {
      console.error("[HISTORY-GET] ❌ Error fetching version:", {
        filePath,
        version,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Xóa các version cao hơn version được chỉ định (dùng khi revert)
   */
  public async deleteVersionsAfter(
    filePath: string,
    version: number,
  ): Promise<void> {
    if (!this.activeConversationId) {
      return;
    }

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) {
        return;
      }

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);

      const files = await fs.promises.readdir(historyDir);
      let deletedCount = 0;
      const deletedVersions: number[] = [];

      for (const file of files) {
        if (file.startsWith(fileHash) && file.endsWith(".json")) {
          const versionMatch = file.match(/_v(\d+)\.json$/);
          if (versionMatch) {
            const fileVersion = parseInt(versionMatch[1], 10);
            if (fileVersion > version) {
              const historyFilePath = path.join(historyDir, file);
              await fs.promises.unlink(historyFilePath);
              deletedCount++;
              deletedVersions.push(fileVersion);
            }
          }
        }
      }
    } catch (error) {
      console.error("[HISTORY-DELETE] Error deleting versions:", error);
    }
  }

  /**
   * Xóa các version có messageTimestamp >= revertTimestamp (dùng khi revert message)
   */
  public async deleteVersionsFromTimestamp(
    filePath: string,
    revertTimestamp: number,
  ): Promise<void> {
    if (!this.activeConversationId) {
      return;
    }

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) {
        return;
      }

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);

      const files = await fs.promises.readdir(historyDir);
      let deletedCount = 0;
      const deletedVersions: number[] = [];

      for (const file of files) {
        if (file.startsWith(fileHash) && file.endsWith(".json")) {
          try {
            const historyFilePath = path.join(historyDir, file);
            const raw = await fs.promises.readFile(historyFilePath, "utf-8");
            const history: ReplaceInFileHistory = JSON.parse(raw);

            // Delete if messageTimestamp >= revertTimestamp
            if (
              history.filePath === filePath &&
              history.messageTimestamp &&
              history.messageTimestamp >= revertTimestamp
            ) {
              await fs.promises.unlink(historyFilePath);
              deletedCount++;
              deletedVersions.push(history.version);
            }
          } catch (e) {
            // Skip invalid files
          }
        }
      }
    } catch (error) {
      console.error(
        "[HISTORY-DELETE-TIMESTAMP] Error deleting versions:",
        error,
      );
    }
  }

  /**
   * Xóa các version có responseNumber >= revertResponseNumber (dùng khi revert message)
   * Chính xác hơn deleteVersionsFromTimestamp vì không phụ thuộc vào clock skew.
   */
  public async deleteVersionsFromResponseNumber(
    filePath: string,
    revertResponseNumber: number,
  ): Promise<void> {
    if (!this.activeConversationId) {
      return;
    }

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) {
        return;
      }

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);

      const files = await fs.promises.readdir(historyDir);
      let deletedCount = 0;
      const deletedVersions: number[] = [];

      for (const file of files) {
        if (file.startsWith(fileHash) && file.endsWith(".json")) {
          try {
            const historyFilePath = path.join(historyDir, file);
            const raw = await fs.promises.readFile(historyFilePath, "utf-8");
            const history: ReplaceInFileHistory = JSON.parse(raw);

            // Delete if responseNumber >= revertResponseNumber
            if (
              history.filePath === filePath &&
              history.responseNumber !== undefined &&
              history.responseNumber >= revertResponseNumber
            ) {
              await fs.promises.unlink(historyFilePath);
              deletedCount++;
              deletedVersions.push(history.version);
            }
          } catch (e) {
            // Skip invalid files
          }
        }
      }
    } catch (error) {
      console.error(
        "[HISTORY-DELETE-RESPONSE] Error deleting versions:",
        error,
      );
    }
  }
}
