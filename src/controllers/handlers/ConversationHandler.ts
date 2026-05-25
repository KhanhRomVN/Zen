import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { FileLockManager } from "../../managers/FileLockManager";
import { CheckpointManager } from "../../utils/CheckpointManager";

export class ConversationHandler {
  constructor(
    private fileLockManager: FileLockManager,
  ) {}

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

  public async handleGetHistory(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await fs.promises.mkdir(projectContextDir, { recursive: true });
      await this.enforceHistoryLimit(projectContextDir);
      const entries = await fs.promises.readdir(projectContextDir, {
        withFileTypes: true,
      });

      const history = [];
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          try {
            const content = await fs.promises.readFile(
              path.join(projectContextDir, entry.name),
              "utf-8",
            );
            const data = JSON.parse(content);
            const conversationId = entry.name.replace(".json", "");
            if (!Array.isArray(data) && data.metadata) {
              history.push({
                ...data.metadata,
                id: conversationId,
                messageCount: data.messages?.length || 0,
              });
            } else if (Array.isArray(data) && data.length > 0) {
              // Get last user message as title
              const userMessages = data.filter((m: any) => m.role === "user");
              const lastUserMsg = userMessages[userMessages.length - 1] || data[0];
              let rawTitle = lastUserMsg.content || "";
              // Strip ## User Message wrapper
              const titleMatch = rawTitle.match(/## User Message\n```\n([\s\S]*?)\n```/);
              if (titleMatch) rawTitle = titleMatch[1];
              const title = rawTitle.replace(/\n/g, " ").trim().substring(0, 100);

              history.push({
                id: conversationId,
                title,
                timestamp: data[data.length - 1].timestamp || Date.now(),
                lastModified: data[data.length - 1].timestamp || Date.now(),
                preview: title,
                messageCount: data.length,
                totalRequests: userMessages.length,
                totalTokenUsage: data.reduce((sum: number, m: any) => sum + (m.token_usage || 0), 0),
              });
            }
          } catch {}
        }
      }
      history.sort((a, b) => {
        const timeA = new Date(a.lastModified || a.timestamp).getTime();
        const timeB = new Date(b.lastModified || b.timestamp).getTime();
        return timeB - timeA;
      });
      webviewView.webview.postMessage({
        command: "historyResult",
        requestId: message.requestId,
        history,
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "historyResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }

  public async handleGetConversation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        return;
      }
      const { conversationId } = message;
      const projectContextDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      const exists = fs.existsSync(logPath);

      if (!exists) {
        // Try searching across all project dirs
        const contextRoot = this.getContextRoot();
        const projectsDir = path.join(contextRoot, "projects");
        try {
          const projectDirs = await fs.promises.readdir(projectsDir);
          for (const dir of projectDirs) {
            const candidate = path.join(projectsDir, dir, `${conversationId}.json`);
            if (fs.existsSync(candidate)) {
              const content = await fs.promises.readFile(candidate, "utf-8");
              webviewView.webview.postMessage({
                command: "conversationResult",
                requestId: message.requestId,
                data: { messages: JSON.parse(content), conversationId },
              });
              return;
            }
          }
        } catch (searchErr) {
        }
        throw new Error(`File not found: ${logPath}`);
      }

      const content = await fs.promises.readFile(logPath, "utf-8");
      const parsed = JSON.parse(content);

      webviewView.webview.postMessage({
        command: "conversationResult",
        requestId: message.requestId,
        data: {
          messages: Array.isArray(parsed) ? parsed : parsed.messages || [],
          conversationId,
        },
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "conversationResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
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
    } catch (e) {
    }
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
    } catch (e) {
    }
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
    } catch (e) {
    }
  }

  public async handleDeleteConversation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const logPath = path.join(
        projectContextDir,
        `${message.conversationId}.json`,
      );
      const backupPath = path.join(projectContextDir, message.conversationId);

      await fs.promises.unlink(logPath).catch(() => {});
      await fs.promises
        .rm(backupPath, { recursive: true, force: true })
        .catch(() => {});

      webviewView.webview.postMessage({
        command: "deleteConversationResult",
        requestId: message.requestId,
        conversationId: message.conversationId,
        success: true,
      });
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        webviewView.webview.postMessage({
          command: "deleteConversationResult",
          requestId: message.requestId,
          error: String(error),
          success: false,
        });
      } else {
        webviewView.webview.postMessage({
          command: "deleteConversationResult",
          requestId: message.requestId,
          conversationId: message.conversationId,
          success: true,
        });
      }
    }
  }

  public async handleDeleteAllConversations(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const entries = await fs.promises.readdir(projectContextDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          await fs.promises.unlink(path.join(projectContextDir, entry.name));
        } else if (entry.isDirectory()) {
          await fs.promises.rm(path.join(projectContextDir, entry.name), {
            recursive: true,
            force: true,
          });
        }
      }
      webviewView.webview.postMessage({
        command: "deleteAllConversationsResult",
        requestId: message.requestId,
        success: true,
      });
    } catch (e) {
      webviewView.webview.postMessage({
        command: "deleteAllConversationsResult",
        requestId: message.requestId,
        success: false,
        error: String(e),
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

  public async handleRenameConversationLog(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const dir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
      const oldPath = path.join(dir, `${message.oldConversationId}.json`);
      const newPath = path.join(dir, `${message.newConversationId}.json`);

      let retries = 10;
      while (retries > 0) {
        if (fs.existsSync(oldPath)) break;
        await new Promise((r) => setTimeout(r, 200));
        retries--;
      }

      if (fs.existsSync(oldPath)) {
        await fs.promises.rename(oldPath, newPath);
        webviewView.webview.postMessage({
          command: "renameConversationLogResult",
          success: true,
          oldConversationId: message.oldConversationId,
          newConversationId: message.newConversationId,
        });
      }
    } catch (e) {
      webviewView.webview.postMessage({
        command: "renameConversationLogResult",
        success: false,
        error: String(e),
      });
    }
  }

  public async handleSaveTerminalOutput(message: any) {
    try {
      const { chatUuid, outputUuid, content } = message;
      if (!chatUuid || !outputUuid || content === undefined) return;

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const terminalOutputsDir = path.join(
        projectContextDir,
        chatUuid,
        "terminal_outputs",
      );

      await fs.promises.mkdir(terminalOutputsDir, { recursive: true });
      const outputPath = path.join(terminalOutputsDir, `${outputUuid}.json`);
      await fs.promises.writeFile(
        outputPath,
        JSON.stringify({ content }, null, 2),
      );
    } catch (e) {
    }
  }

  public async handleReadTerminalOutput(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const { chatUuid, outputUuid, requestId } = message;
      if (!chatUuid || !outputUuid) return;

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const outputPath = path.join(
        projectContextDir,
        chatUuid,
        "terminal_outputs",
        `${outputUuid}.json`,
      );

      if (fs.existsSync(outputPath)) {
        const data = await fs.promises.readFile(outputPath, "utf-8");
        const parsed = JSON.parse(data);
        webviewView.webview.postMessage({
          command: "readTerminalOutputResult",
          requestId,
          outputUuid,
          content: parsed.content,
        });
      } else {
        webviewView.webview.postMessage({
          command: "readTerminalOutputResult",
          requestId,
          outputUuid,
          error: "Terminal output file not found",
        });
      }
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "readTerminalOutputResult",
        requestId: message.requestId,
        outputUuid: message.outputUuid,
        error: String(e),
      });
    }
  }

  public async handleSendMessage(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    // Basic messaging logic if needed
  }

  public async handleRevertConversation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const { conversationId, messageId, timestamp } = message;
      if (!conversationId || !messageId) return;

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      if (!fs.existsSync(logPath)) {
        throw new Error(`Log file not found: ${logPath}`);
      }

      const release = await this.fileLockManager.acquire(logPath);
      try {
        const fileData = await fs.promises.readFile(logPath, "utf-8");
        let content = JSON.parse(fileData);
        if (!Array.isArray(content)) {
          throw new Error("Invalid conversation log format");
        }

        const index = content.findIndex((m: any) => m.id === messageId);
        if (index === -1) {
          throw new Error(`Message with ID ${messageId} not found in history`);
        }

        const targetMsg = content[index];
        const revertTimestamp = typeof targetMsg.timestamp === "string"
          ? new Date(targetMsg.timestamp).getTime()
          : (targetMsg.timestamp || timestamp);

        content = content.slice(0, index + 1);
        await fs.promises.writeFile(logPath, JSON.stringify(content, null, 2), "utf-8");

        // Revert files to the state they were in at/before the revertTimestamp
        await CheckpointManager.getInstance().revertToCheckpoint(conversationId, revertTimestamp);

      } finally {
        release();
      }

      webviewView.webview.postMessage({
        command: "conversationReverted",
        conversationId,
      });

    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "conversationRevertedError",
        error: e.message,
      });
    }
  }

  public async handleOpenConversationFolder(message: any) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const { conversationId } = message;
      if (!conversationId) return;
      const folderPath = path.join(
        this.getProjectContextDir(workspaceFolder.uri.fsPath),
        conversationId,
      );
      await fs.promises.mkdir(folderPath, { recursive: true });
      await vscode.commands.executeCommand(
        "revealFileInOS",
        vscode.Uri.file(folderPath),
      );
    } catch (e) {
    }
  }

  private async enforceHistoryLimit(projectContextDir: string) {
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

      // Sort descending (newest first)
      jsonFiles.sort((a, b) => b.mtime - a.mtime);

      // Keep first 30, delete the rest
      const toDelete = jsonFiles.slice(30);
      for (const item of toDelete) {
        const logPath = path.join(projectContextDir, item.name);
        const conversationId = item.name.replace(".json", "");
        const folderPath = path.join(projectContextDir, conversationId);

        await fs.promises.unlink(logPath).catch(() => {});
        await fs.promises.rm(folderPath, { recursive: true, force: true }).catch(() => {});
      }
    } catch (err) {
    }
  }
}
