import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { FileLockManager } from "../../managers/FileLockManager";
import { BackupManager } from "../../managers/BackupManager";

export class ConversationHandler {
  constructor(
    private fileLockManager: FileLockManager,
    private backupManager: BackupManager | undefined,
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
              let extractedTitle: string | undefined;
              for (let i = data.length - 1; i >= 0; i--) {
                const msg = data[i];
                if (msg.role === "assistant" && msg.content) {
                  const nameMatch = msg.content.match(
                    /<conversation_name>(?:<value>)?([\s\S]*?)(?:<\/value>)?<\/conversation_name>/i,
                  );
                  if (nameMatch && nameMatch[1].trim()) {
                    extractedTitle = nameMatch[1].trim();
                    break;
                  }
                }
              }

              history.push({
                id: conversationId,
                title: extractedTitle || data[0].content.substring(0, 100),
                timestamp: data[data.length - 1].timestamp || Date.now(),
                lastModified: data[data.length - 1].timestamp || Date.now(),
                preview: data[0].content.substring(0, 150),
                messageCount: data.length,
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
      if (!workspaceFolder) return;
      const { conversationId } = message;
      const logPath = path.join(
        this.getProjectContextDir(workspaceFolder.uri.fsPath),
        `${conversationId}.json`,
      );
      const content = await fs.promises.readFile(logPath, "utf-8");

      webviewView.webview.postMessage({
        command: "conversationResult",
        requestId: message.requestId,
        data: {
          messages: JSON.parse(content),
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

        if (this.backupManager) {
          await this.backupManager.cleanupOldConversations(projectContextDir);
        }
      } finally {
        release();
      }
    } catch (e) {
      console.error("Log conversation failed", e);
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
    } catch (e) {
      console.error("Create empty chat log failed", e);
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

        if (this.backupManager) {
          await this.backupManager.cleanupOldConversations(projectContextDir);
        }
      } finally {
        release();
      }
    } catch (e) {
      console.error("Log chat failed", e);
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
      console.error("[ConversationHandler] Save terminal output failed", e);
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
}
