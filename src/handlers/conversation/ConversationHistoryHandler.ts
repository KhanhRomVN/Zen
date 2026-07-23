import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { GlobalStorageManager } from "../../storage/GlobalStorageManager";
import { PathService } from "../../services/PathService";

export class ConversationHistoryHandler {
  private pathService: PathService;

  constructor(private storageManager?: GlobalStorageManager) {
    this.pathService = PathService.getInstance();
  }

  public getContextRoot(): string {
    return this.pathService.getContextRoot();
  }

  public getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
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
              const userMessages = data.filter((m: any) => m.role === "user");
              const lastUserMsg =
                [...userMessages]
                  .reverse()
                  .find((m: any) =>
                    m.content?.includes("<zen-user-content>"),
                  ) ||
                userMessages[userMessages.length - 1] ||
                data[0];
              let rawTitle = lastUserMsg.content || "";
              const titleMatch =
                rawTitle.match(
                  /## User Message\n<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
                ) || rawTitle.match(/## User Message\n```\n([\s\S]*?)\n```/);
              if (titleMatch) rawTitle = titleMatch[1];
              const title = rawTitle
                .replace(/\n/g, " ")
                .trim()
                .substring(0, 100);

              history.push({
                id: conversationId,
                title,
                timestamp: data[data.length - 1].timestamp || Date.now(),
                lastModified: data[data.length - 1].timestamp || Date.now(),
                preview: title,
                messageCount: data.length,
                totalRequests: userMessages.length,
                totalTokenUsage: data.reduce(
                  (sum: number, m: any) => sum + (m.token_usage || 0),
                  0,
                ),
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
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      const exists = fs.existsSync(logPath);

      if (!exists) {
        const contextRoot = this.getContextRoot();
        const projectsDir = path.join(contextRoot, "projects");
        try {
          const projectDirs = await fs.promises.readdir(projectsDir);
          for (const dir of projectDirs) {
            const candidate = path.join(
              projectsDir,
              dir,
              `${conversationId}.json`,
            );
            if (fs.existsSync(candidate)) {
              const content = await fs.promises.readFile(candidate, "utf-8");
              const candidateParsed = JSON.parse(content);
              const isArray = Array.isArray(candidateParsed);
              const toolOutputs = isArray
                ? ((await this.storageManager?.getToolOutputsForConversation(
                    conversationId,
                  )) ?? undefined)
                : (candidateParsed.toolOutputs ??
                  (await this.storageManager?.getToolOutputsForConversation(
                    conversationId,
                  )) ??
                  undefined);

              const conversationFileStats = isArray
                ? undefined
                : candidateParsed.conversationFileStats;

              const messages = isArray
                ? candidateParsed
                : candidateParsed.messages || [];

              webviewView.webview.postMessage({
                command: "conversationResult",
                requestId: message.requestId,
                data: {
                  messages: messages,
                  conversationId,
                  backendConversationId: isArray
                    ? undefined
                    : candidateParsed.backendConversationId,
                  toolOutputs,
                  singleLineReviewActions: isArray
                    ? undefined
                    : candidateParsed.singleLineReviewActions,
                  conversationFileStats,
                },
              });
              return;
            }
          }
        } catch (searchErr) {
          console.error(
            `[ConversationHandler] fallback search error:`,
            searchErr,
          );
        }
        throw new Error(`File not found: ${logPath}`);
      }

      const content = await fs.promises.readFile(logPath, "utf-8");
      const parsed = JSON.parse(content);
      const isArray = Array.isArray(parsed);
      const toolOutputsFromStorage =
        await this.storageManager?.getToolOutputsForConversation(
          conversationId,
        );
      const toolOutputs = isArray
        ? (toolOutputsFromStorage ?? undefined)
        : (parsed.toolOutputs ?? toolOutputsFromStorage ?? undefined);

      const messages = isArray ? parsed : parsed.messages || [];

      const conversationFileStats = isArray
        ? undefined
        : parsed.conversationFileStats;

      webviewView.webview.postMessage({
        command: "conversationResult",
        requestId: message.requestId,
        data: {
          messages: messages,
          conversationId,
          backendConversationId: isArray
            ? undefined
            : parsed.backendConversationId,
          toolOutputs,
          singleLineReviewActions: isArray
            ? undefined
            : parsed.singleLineReviewActions,
          conversationFileStats,
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
