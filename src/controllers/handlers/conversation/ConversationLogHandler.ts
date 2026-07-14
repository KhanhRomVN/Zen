import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { FileLockManager } from "../../../managers/FileLockManager";

export class ConversationLogHandler {
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

  public async handleLogConversation(message: any) {
    const { conversationId, logEntry } = message;
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await fs.promises.mkdir(projectContextDir, { recursive: true });
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      const release = await this.fileLockManager.acquire(logPath);
      try {
        let content: any[] = [];
        try {
          const fileData = await fs.promises.readFile(logPath, "utf-8");
          content = JSON.parse(fileData);
          if (!Array.isArray(content)) content = [];
        } catch {
          content = [];
        }

        content.push(logEntry);
        await fs.promises.writeFile(logPath, JSON.stringify(content, null, 2));
      } finally {
        release();
      }
      await this.enforceHistoryLimit(projectContextDir);
    } catch (e) {}
  }

  public async handleCreateEmptyChatLog(message: any) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const { chatUuid } = message;
      if (!chatUuid) return;
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await fs.promises.mkdir(projectContextDir, { recursive: true });
      const logPath = path.join(projectContextDir, `${chatUuid}.json`);

      const release = await this.fileLockManager.acquire(logPath);
      try {
        if (!fs.existsSync(logPath)) {
          await fs.promises.writeFile(logPath, JSON.stringify([], null, 2));
        }
      } finally {
        release();
      }
      await this.enforceHistoryLimit(projectContextDir);
    } catch (e) {}
  }

  public async handleLogChat(message: any) {
    const { chatUuid, logEntry } = message;
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      if (!chatUuid || !logEntry) return;
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await fs.promises.mkdir(projectContextDir, { recursive: true });
      const logPath = path.join(projectContextDir, `${chatUuid}.json`);

      const release = await this.fileLockManager.acquire(logPath);
      try {
        let content: any[] = [];
        try {
          const fileData = await fs.promises.readFile(logPath, "utf-8");
          const parsed = JSON.parse(fileData);
          content = Array.isArray(parsed) ? parsed : [];
        } catch {
          content = [];
        }

        content.push(logEntry);
        await fs.promises.writeFile(logPath, JSON.stringify(content, null, 2));
      } finally {
        release();
      }
      await this.enforceHistoryLimit(projectContextDir);
    } catch (e) {}
  }

  public async enforceHistoryLimit(projectContextDir: string) {
    try {
      const files = await fs.promises.readdir(projectContextDir);
      const jsonFiles: { name: string; mtime: number }[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(projectContextDir, file);
          try {
            const stats = await fs.promises.stat(filePath);
            jsonFiles.push({ name: file, mtime: stats.mtimeMs });
          } catch {}
        }
      }

      if (jsonFiles.length <= 30) return;

      jsonFiles.sort((a, b) => b.mtime - a.mtime);

      const toDelete = jsonFiles.slice(30);
      for (const item of toDelete) {
        const logPath = path.join(projectContextDir, item.name);
        const conversationId = item.name.replace(".json", "");
        const folderPath = path.join(projectContextDir, conversationId);

        await fs.promises.unlink(logPath).catch(() => {});
        await fs.promises
          .rm(folderPath, { recursive: true, force: true })
          .catch(() => {});
      }
    } catch (err) {}
  }
}