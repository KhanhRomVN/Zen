import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
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

  public getActiveConversationId(): string | null {
    return this.activeConversationId;
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
  ): Promise<void> {
    if (!this.activeConversationId) return;

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      await fs.promises.mkdir(historyDir, { recursive: true });

      // Lấy version hiện tại của file này
      const currentVersion = await this.getCurrentVersion(filePath);
      const newVersion = currentVersion + 1;

      const timestamp = Date.now();
      const id = `replace_${timestamp}_${crypto.randomBytes(4).toString("hex")}`;
      const lineCount = fullContent.split('\n').length;
      
      const history: ReplaceInFileHistory = {
        id,
        filePath,
        version: newVersion,
        fullContent,
        errorCount,
        warningCount,
        lineCount,
        timestamp,
      };

      // Lưu file JSON theo pattern: {filePath_hash}_v{version}.json
      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);
      const historyFileName = `${fileHash}_v${newVersion}.json`;
      const historyFilePath = path.join(historyDir, historyFileName);

      await fs.promises.writeFile(
        historyFilePath,
        JSON.stringify(history, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("[ReplaceInFileHistoryManager] Error saving history:", error);
    }
  }

  /**
   * Lấy version hiện tại cao nhất của file
   */
  private async getCurrentVersion(filePath: string): Promise<number> {
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
                lineCount = history.fullContent.split('\n').length;
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
    if (!this.activeConversationId) return null;

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) return null;

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);
      const historyFileName = `${fileHash}_v${version}.json`;
      const historyFilePath = path.join(historyDir, historyFileName);

      if (!fs.existsSync(historyFilePath)) return null;

      const raw = await fs.promises.readFile(historyFilePath, "utf-8");
      const history: ReplaceInFileHistory = JSON.parse(raw);

      return history;
    } catch (error) {
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
    if (!this.activeConversationId) return;

    try {
      const historyDir = this.getHistoryDir(this.activeConversationId);
      if (!fs.existsSync(historyDir)) return;

      const fileHash = crypto
        .createHash("md5")
        .update(filePath)
        .digest("hex")
        .substring(0, 8);

      const files = await fs.promises.readdir(historyDir);

      for (const file of files) {
        if (file.startsWith(fileHash) && file.endsWith(".json")) {
          const versionMatch = file.match(/_v(\d+)\.json$/);
          if (versionMatch) {
            const fileVersion = parseInt(versionMatch[1], 10);
            if (fileVersion > version) {
              const historyFilePath = path.join(historyDir, file);
              await fs.promises.unlink(historyFilePath);
            }
          }
        }
      }
    } catch (error) {
      console.error(
        "[ReplaceInFileHistoryManager] Error deleting versions:",
        error,
      );
    }
  }
}
