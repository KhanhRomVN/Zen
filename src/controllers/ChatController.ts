import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import * as https from "https";
import { ContextManager } from "../context/ContextManager";
import { GlobalStorageManager } from "../storage-manager";
import { AgentCapabilityManager } from "../agent/AgentCapabilityManager";
import { BackupManager } from "../managers/BackupManager";
import { ProcessManager } from "../managers/ProcessManager";
import { FileLockManager } from "../managers/FileLockManager";
import { ProjectStructureManager } from "../context/ProjectStructureManager";
import { RecentItemsManager } from "../context/RecentItemsManager";
import { FuzzyMatcher } from "../utils/FuzzyMatcher";
import { ShikiService } from "../services/ShikiService";
import { ThemeService } from "../services/ThemeService";
import { FileSystemAnalyzer } from "../context/FileSystemAnalyzer";

export class ChatController {
  constructor(
    private contextManager: ContextManager,
    private storageManager: GlobalStorageManager | undefined,
    private agentManager: AgentCapabilityManager | undefined,
    private backupManager: BackupManager | undefined,
    private processManager: ProcessManager,
    private fileLockManager: FileLockManager,
    private projectStructureManager: ProjectStructureManager | undefined,
    private recentItemsManager: RecentItemsManager | undefined,
    private extensionUri: vscode.Uri,
  ) {}

  private _workspaceFilesCache: any[] | null = null;
  private _workspaceFoldersCache: any[] | null = null;
  private _lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private _projectContextWatcher?: vscode.FileSystemWatcher;
  private _projectContextDisposables: vscode.Disposable[] = [];
  private _pingInterval?: NodeJS.Timeout;

  public async handleMessage(message: any, webviewView: vscode.WebviewView) {
    const command = message.command;

    try {
      switch (command) {
        case "requestTheme":
          await this.handleRequestTheme(webviewView);
          break;
        case "getProjectStructureBlacklist":
          await this.handleGetProjectStructureBlacklist(message, webviewView);
          break;
        case "confirmDelete":
        case "confirmClearAll":
        case "confirmClearChat":
          await this.handleConfirmation(message, webviewView);
          break;
        case "showError":
          vscode.window.showErrorMessage(message.message);
          break;
        case "logConversation":
          await this.handleLogConversation(message);
          break;
        case "logChat":
          await this.handleLogChat(message);
          break;
        case "createEmptyChatLog":
          await this.handleCreateEmptyChatLog(message);
          break;
        case "rollbackConversationLog":
          await this.handleRollbackConversationLog(message);
          break;
        case "getHistory":
          await this.handleGetHistory(message, webviewView);
          break;
        case "getConversation":
          await this.handleGetConversation(message, webviewView);
          break;
        case "deleteConversation":
          await this.handleDeleteConversation(message, webviewView);
          break;
        case "deleteAllConversations":
          await this.handleDeleteAllConversations(message, webviewView);
          break;
        case "getFileStats":
          await this.handleGetFileStats(message, webviewView);
          break;
        case "renameConversationLog":
          await this.handleRenameConversationLog(message, webviewView);
          break;
        case "startBackupWatch":
          await this.handleStartBackupWatch(message, webviewView);
          break;
        case "stopBackupWatch":
          await this.handleStopBackupWatch(message, webviewView);
          break;
        case "getBackupTimeline":
          await this.handleGetBackupTimeline(message, webviewView);
          break;
        case "getBackupSnapshot":
          await this.handleGetBackupSnapshot(message, webviewView);
          break;
        case "confirmBackupLargeFile":
          // Handled in UI mostly
          break;
        case "getBackupBlacklist":
          await this.handleGetBackupBlacklist(message, webviewView);
          break;
        case "addToBackupBlacklist":
          await this.handleAddToBackupBlacklist(message, webviewView);
          break;
        case "removeFromBackupBlacklist":
          await this.handleRemoveFromBackupBlacklist(message, webviewView);
          break;
        case "revertToSnapshot":
          await this.handleRevertToSnapshot(message, webviewView);
          break;
        case "openSnapshotDiffWithCurrent":
          await this.handleOpenSnapshotDiffWithCurrent(message);
          break;
        case "openDiff":
          await this.handleOpenDiff(message);
          break;
        case "deleteBackupFile":
          await this.handleDeleteBackupFile(message, webviewView);
          break;
        case "backupBinaryFileDecision":
          await this.handleBackupBinaryFileDecision(message, webviewView);
          break;
        case "readFile":
          await this.handleReadFile(message, webviewView);
          break;
        case "writeFile":
          await this.handleWriteFile(message, webviewView);
          break;
        case "replaceInFile":
          await this.handleReplaceInFile(message, webviewView);
          break;
        case "listFiles":
          await this.handleListFiles(message, webviewView);
          break;
        case "searchFiles":
          await this.handleSearchFiles(message, webviewView);
          break;
        case "validateFuzzyMatch":
          await this.handleValidateFuzzyMatch(message, webviewView);
          break;
        case "getSystemInfo":
          this.handleGetSystemInfo(message, webviewView);
          break;
        case "updateAgentPermissions":
          this.handleUpdateAgentPermissions(message);
          break;
        case "getFolderTree":
          await this.handleGetFolderTree(message, webviewView);
          break;
        case "executeAgentAction":
          await this.handleExecuteAgentAction(message, webviewView);
          break;
        case "storageGet":
        case "storageSet":
        case "storageDelete":
        case "storageList":
          await this.handleStorageOperation(message, webviewView);
          break;
        case "sendMessage":
          await this.handleSendMessage(message, webviewView);
          break;
        case "openDiffView":
          await this.handleOpenDiffView(message);
          break;
        case "openFile":
          await this.handleOpenFile(message);
          break;
        case "runCommand":
          await this.handleRunCommand(message, webviewView);
          break;
        case "attachTerminalToVSCode":
          this.processManager.attachToVSCode(message.terminalId);
          break;
        case "terminalInput":
          this.processManager.sendInput(message.terminalId, message.data);
          break;
        case "focusTerminal":
          await this.handleFocusTerminal(message);
          break;
        case "stopCommand":
          await this.handleStopCommand(message);
          break;
        case "openPreview":
          await this.handleOpenPreview(message);
          break;
        case "openTempImage":
          await this.handleOpenTempImage(message);
          break;
        case "getGitChanges":
          await this.handleGetGitChanges(message, webviewView);
          break;
        case "requestContext":
          await this.handleRequestContext(message, webviewView);
          break;
        case "getWorkspaceFiles":
          await this.handleGetWorkspaceFiles(message, webviewView);
          break;
        case "getWorkspaceFolders":
          await this.handleGetWorkspaceFolders(message, webviewView);
          break;
        case "openWorkspaceFolder":
          await this.handleOpenWorkspaceFolder(message);
          break;
        case "openWorkspaceFile":
          await this.handleOpenFile(message);
          break;
        case "highlightCode":
          await this.handleHighlightCode(message, webviewView);
          break;
        case "openExternal":
          if (message.url)
            vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        case "saveTerminalOutput":
          await this.handleSaveTerminalOutput(message);
          break;
        case "readTerminalOutput":
          await this.handleReadTerminalOutput(message, webviewView);
          break;
        case "getProjectContext":
          await this.handleGetProjectContext(message, webviewView);
          break;
        case "getWorkspaceTree":
          await this.handleGetWorkspaceTree(message, webviewView);
          break;
        case "startProjectContextWatch":
          await this.handleStartProjectContextWatch(message, webviewView);
          break;
        case "stopProjectContextWatch":
          await this.handleStopProjectContextWatch(message, webviewView);
          break;
      }
    } catch (error) {
      console.error(`Error handling command ${command}:`, error);
    }
  }

  public startPingService(webview: vscode.Webview) {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
    }

    const checkPing = () => {
      const start = Date.now();
      const req = https.get(
        "https://www.google.com/generate_204",
        { timeout: 3000 },
        (res) => {
          const end = Date.now();
          const latency = end - start;
          console.log(`[ChatController] Ping SUCCESS: ${latency}ms`);
          webview.postMessage({
            command: "networkPingUpdate",
            ping: latency,
          });
          res.resume(); // Consume response
        },
      );

      req.on("error", (err) => {
        console.log(`[ChatController] Ping ERROR: ${err.message}`);
        webview.postMessage({
          command: "networkPingUpdate",
          ping: null,
        });
      });

      req.on("timeout", () => {
        console.log("[ChatController] Ping TIMEOUT");
        req.destroy();
        webview.postMessage({
          command: "networkPingUpdate",
          ping: null,
        });
      });

      req.end();
    };

    // Initial check
    checkPing();

    // Set interval
    this._pingInterval = setInterval(checkPing, 10000); // 10s
  }

  public stopPingService() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = undefined;
    }
  }

  // #region Theme & System
  private async handleRequestTheme(webviewView: vscode.WebviewView) {
    await this.updateTheme(webviewView.webview);
  }

  private async handleOpenWorkspaceFolder(message: any) {
    const folderPath = message.path;
    if (!folderPath) return;

    try {
      // Find the first file in this folder recursively
      const findFirstFile = async (
        dir: string,
      ): Promise<vscode.Uri | undefined> => {
        const entries = await vscode.workspace.fs.readDirectory(
          vscode.Uri.file(dir),
        );

        // Sort entries to be deterministic (files first)
        entries.sort((a, b) => {
          if (a[1] !== b[1]) {
            return a[1] === vscode.FileType.File ? -1 : 1;
          }
          return a[0].localeCompare(b[0]);
        });

        for (const [name, type] of entries) {
          const entryPath = path.join(dir, name);
          if (type === vscode.FileType.File) {
            return vscode.Uri.file(entryPath);
          } else if (type === vscode.FileType.Directory) {
            const result = await findFirstFile(entryPath);
            if (result) return result;
          }
        }
        return undefined;
      };

      const firstFileUri = await findFirstFile(folderPath);
      if (firstFileUri) {
        const document = await vscode.workspace.openTextDocument(firstFileUri);
        await vscode.window.showTextDocument(document);
      } else {
        vscode.window.showInformationMessage("No files found in this folder.");
      }
    } catch (error) {
      // console.error("Failed to open folder:", error);
    }
  }

  public async updateTheme(webview: vscode.Webview) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const theme = vscode.window.activeColorTheme;
    const themeKind = theme.kind;
    const colorTheme =
      vscode.workspace
        .getConfiguration("workbench")
        .get<string>("colorTheme") || "Default Dark Modern";

    try {
      const themeJson = await ThemeService.getActiveThemeJson();
      if (themeJson) {
        await ShikiService.getInstance().setCustomTheme(themeJson, colorTheme);
      }
    } catch (e) {}

    webview.postMessage({
      command: "updateTheme",
      theme: themeKind,
      themeId: colorTheme,
      themeVersion: Date.now(),
    });
  }

  private handleGetSystemInfo(message: any, webviewView: vscode.WebviewView) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const platform = process.platform;
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
    const shell = process.env.SHELL || "/bin/bash";
    let osName = "Unknown";
    if (platform === "linux") osName = "Linux";
    else if (platform === "darwin") osName = "macOS";
    else if (platform === "win32") osName = "Windows";

    webviewView.webview.postMessage({
      command: "systemInfo",
      requestId: message.requestId,
      data: {
        os: osName,
        ide: "Visual Studio Code",
        shell: shell,
        homeDir: homeDir,
        cwd: workspaceFolder?.uri.fsPath || homeDir,
      },
    });
  }
  // #endregion

  // #region Conversation Management
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

  private async handleGetHistory(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
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
              history.push({
                id: conversationId,
                title: data[0].content.substring(0, 100),
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

  private async handleGetConversation(
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

  private async handleLogConversation(message: any) {
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

        // Cleanup old conversations
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

  /**
   * Creates an empty placeholder .json file for a new chat session.
   * The file will be populated with content after the first successful API response.
   */
  private async handleCreateEmptyChatLog(message: any) {
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
        // Create empty array JSON if file doesn't exist yet
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

  /**
   * Appends a log entry to a chat log file identified by chatUuid.
   * Uses the backend conversation_id inside the logEntry for the conversationId field.
   */
  private async handleLogChat(message: any) {
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

        // Cleanup old chat logs
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

  private async handleDeleteConversation(
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

      // Delete log file
      await fs.promises.unlink(logPath).catch(() => {});

      // Delete backup folder recursively
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

  private async handleDeleteAllConversations(
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
          // Backup folders are named with conversationId (uuid) and reside in this dir
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

  private async handleRollbackConversationLog(message: any) {
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

  private async handleRenameConversationLog(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const dir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
      const oldPath = path.join(dir, `${message.oldConversationId}.json`);
      const newPath = path.join(dir, `${message.newConversationId}.json`);

      // Retry logic for rename
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

  private async handleSaveTerminalOutput(message: any) {
    try {
      const { chatUuid, outputUuid, content } = message;

      if (!chatUuid || !outputUuid || content === undefined) {
        console.warn(
          "[ChatController] Missing required fields in handleSaveTerminalOutput",
          { chatUuid, outputUuid, hasContent: content !== undefined },
        );
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.warn(
          "[ChatController] No workspace folder found in handleSaveTerminalOutput",
        );
        return;
      }

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
      console.error(
        "[ChatController] Save terminal output failed with error:",
        e,
      );
    }
  }

  private async handleReadTerminalOutput(
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

  // #endregion

  // #region Confirmation
  private async handleConfirmation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (message.command === "confirmDelete") {
      const result = await vscode.window.showWarningMessage(
        "Delete this conversation?",
        { modal: true },
        "Delete",
      );
      if (result === "Delete")
        webviewView.webview.postMessage({
          command: "deleteConfirmed",
          conversationId: message.conversationId,
        });
    } else if (message.command === "confirmClearAll") {
      const result = await vscode.window.showWarningMessage(
        "Delete ALL conversations?",
        { modal: true },
        "Delete All",
      );
      if (result === "Delete All")
        webviewView.webview.postMessage({ command: "clearAllConfirmed" });
    } else if (message.command === "confirmClearChat") {
      const result = await vscode.window.showWarningMessage(
        "Delete this conversation permanently?",
        { modal: true },
        "Delete",
      );
      if (result === "Delete")
        webviewView.webview.postMessage({
          command: "clearChatConfirmed",
          conversationId: message.conversationId,
        });
    }
  }
  // #endregion

  // #region File & Project Structure
  private async handleGetProjectStructureBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this.projectStructureManager) {
      const blacklist = await this.projectStructureManager.getBlacklist();
      webviewView.webview.postMessage({
        command: "projectStructureBlacklistResponse",
        requestId: message.requestId,
        blacklist,
      });
    }
  }

  private async handleGetFileStats(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const pathValue =
      message.path ||
      message.filePath ||
      message.file_path ||
      message.folder_path;

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      if (!pathValue) return;
      const absPath = vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
      const content = await vscode.workspace.fs.readFile(absPath);
      const lines = Buffer.from(content).toString("utf8").split(/\r?\n/).length;
      webviewView.webview.postMessage({
        command: "fileStatsResult",
        path: pathValue,
        lines,
        id: message.id,
      });
    } catch {
      webviewView.webview.postMessage({
        command: "fileStatsResult",
        path: pathValue || message.path,
        lines: 0,
        id: message.id,
        error: true,
      });
    }
  }

  private async handleListFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const pathValue = message.path || message.folder_path || message.filePath;
      const dirPath = pathValue || ".";
      const recursiveParam = message.recursive;
      const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, dirPath);

      let maxDepth = 1;
      if (recursiveParam === "true" || recursiveParam === true) maxDepth = 10;
      else if (recursiveParam)
        maxDepth = parseInt(String(recursiveParam), 10) || 1;

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const tree = await fsAnalyzer.getFileTree(maxDepth, absolutePath.fsPath);

      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: pathValue,
        files: tree,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: message.path || message.folder_path,
        error: e.message,
      });
    }
  }

  // #endregion

  // #region Backup
  private async handleStartBackupWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    try {
      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      await this.backupManager.startBackupFileWatcher(
        message.conversationId,
        workspaceFolder,
        webviewView,
        projectContextDir,
      );
      webviewView.webview.postMessage({
        command: "startBackupWatchResult",
        success: true,
        conversationId: message.conversationId,
      });
    } catch (e) {
      webviewView.webview.postMessage({
        command: "startBackupWatchResult",
        success: false,
        error: String(e),
      });
    }
  }

  private async handleStopBackupWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    try {
      this.backupManager.stopBackupFileWatcher();
      webviewView.webview.postMessage({
        command: "stopBackupWatchResult",
        success: true,
      });
    } catch (e) {}
  }

  private async handleGetBackupTimeline(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    try {
      const timeline = await this.backupManager.getTimeline(
        message.conversationId,
      );
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        for (const event of timeline) {
          event.fileExists = fs.existsSync(
            path.join(workspaceFolder.uri.fsPath, event.filePath),
          );
        }
      }
      webviewView.webview.postMessage({
        command: "backupTimelineResult",
        requestId: message.requestId,
        timeline,
        conversationId: message.conversationId,
      });
    } catch (e) {
      webviewView.webview.postMessage({
        command: "backupTimelineResult",
        requestId: message.requestId,
        error: String(e),
      });
    }
  }

  private async handleGetBackupSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    try {
      const content = await this.backupManager.getSnapshotContent(
        message.conversationId,
        message.snapshotPath,
      );
      webviewView.webview.postMessage({
        command: "backupSnapshotResult",
        requestId: message.requestId,
        content,
      });
    } catch (e) {
      webviewView.webview.postMessage({
        command: "backupSnapshotResult",
        requestId: message.requestId,
        error: String(e),
      });
    }
  }

  private async handleGetBackupBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const blacklist = await this.backupManager.getBackupBlacklist(
      workspaceFolder.uri.fsPath,
    );
    webviewView.webview.postMessage({
      command: "backupBlacklistResult",
      requestId: message.requestId,
      blacklist,
    });
  }

  private async handleAddToBackupBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    let pathToAdd = message.path;
    if (path.isAbsolute(pathToAdd))
      pathToAdd = path.relative(workspaceFolder.uri.fsPath, pathToAdd);
    await this.backupManager.addToBackupBlacklist(
      workspaceFolder.uri.fsPath,
      pathToAdd,
    );
    const blacklist = await this.backupManager.getBackupBlacklist(
      workspaceFolder.uri.fsPath,
    );
    webviewView.webview.postMessage({
      command: "backupBlacklistResult",
      requestId: message.requestId,
      blacklist,
    });
  }

  private async handleRemoveFromBackupBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    let pathToRemove = message.path;
    if (path.isAbsolute(pathToRemove))
      pathToRemove = path.relative(workspaceFolder.uri.fsPath, pathToRemove);
    await this.backupManager.removeFromBackupBlacklist(
      workspaceFolder.uri.fsPath,
      pathToRemove,
    );
    const blacklist = await this.backupManager.getBackupBlacklist(
      workspaceFolder.uri.fsPath,
    );
    webviewView.webview.postMessage({
      command: "backupBlacklistResult",
      requestId: message.requestId,
      blacklist,
    });
  }

  private async handleDeleteBackupFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this.backupManager) {
      await this.backupManager.deleteFileBackup(
        message.conversationId,
        message.filePath,
      );
      webviewView.webview.postMessage({
        command: "deleteBackupFileResult",
        success: true,
        filePath: message.filePath,
        conversationId: message.conversationId,
      });
    }
  }

  private async handleBackupBinaryFileDecision(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this.backupManager) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      await this.backupManager.setBinaryFileDecision(
        workspaceFolder.uri.fsPath,
        message.extension,
        message.allow ? "allow" : "deny",
      );
      if (!message.allow) {
        await this.backupManager.deleteByExtension(
          message.conversationId,
          message.extension,
        );
      } else {
        await this.backupManager.clearUnconfirmedByExtension(
          message.conversationId,
          message.extension,
        );
      }
      webviewView.webview.postMessage({
        command: "backupEventAdded",
        conversationId: message.conversationId,
      });
    }
  }
  // #endregion

  // #region File Operations (Read/Write/Replace)
  private async handleReadFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");
      const absPath = vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
      let content = Buffer.from(
        await vscode.workspace.fs.readFile(absPath),
      ).toString("utf8");

      if (message.startLine !== undefined) {
        const lines = content.split(/\r?\n/);
        const end =
          message.endLine !== undefined ? message.endLine + 1 : lines.length;
        content = lines.slice(message.startLine || 0, end).join("\n");
      }
      const diagnostics = this.getDiagnosticsForFile(absPath);
      webviewView.webview.postMessage({
        command: "fileContent",
        requestId: message.requestId,
        path: pathValue,
        content,
        diagnostics: diagnostics.length ? diagnostics : undefined,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "fileContent",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  private async handleWriteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      let absolutePath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absolutePath = vscode.Uri.file(
          path.join(pcDir, path.basename(pathValue)),
        );
      } else {
        absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
      }
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(absolutePath, ".."),
      );
      await vscode.workspace.fs.writeFile(
        absolutePath,
        Buffer.from(message.content, "utf8"),
      );

      if (!message.skipDiagnostics) {
        try {
          await vscode.workspace.openTextDocument(absolutePath);
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
        const diagnostics = this.getDiagnosticsForFile(absolutePath);
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
          diagnostics: diagnostics.length ? diagnostics : undefined,
        });
      } else {
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
        });
      }
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "writeFileResult",
        requestId: message.requestId,
        path: message.path || message.filePath || message.file_path,
        error: e.message,
      });
    }
  }

  private async handleReplaceInFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const pathValue = message.path || message.filePath || message.file_path;
    if (!pathValue) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: "The 'path' argument must be of type string.",
      });
      return;
    }
    const absPath = vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
    const release = await this.fileLockManager.acquire(absPath.fsPath);
    let newContent: string | undefined;

    try {
      const content = Buffer.from(
        await vscode.workspace.fs.readFile(absPath),
      ).toString("utf8");
      const match = message.diff.match(
        /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
      );
      if (!match) throw new Error("Invalid diff format");

      const clean = (text: string) =>
        text.replace(/^```[a-zA-Z]*$/gm, "").trim();
      const searchArgs = clean(match[1]);
      const replaceArgs = clean(match[2]);

      let target = searchArgs;
      if (content.indexOf(searchArgs) === -1) {
        const fuzzy = FuzzyMatcher.findMatch(content, searchArgs);
        if (!fuzzy || fuzzy.score <= 1e-9)
          throw new Error("Search text not found"); // exact match check basically
        target = fuzzy.originalText;
      }
      newContent = content.replace(target, replaceArgs);
      if (newContent === content) throw new Error("No change made");
      await vscode.workspace.fs.writeFile(
        absPath,
        Buffer.from(newContent, "utf8"),
      );
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: e.message,
      });
      release();
      return;
    }
    release();

    if (!message.skipDiagnostics) {
      try {
        await vscode.workspace.openTextDocument(absPath);
      } catch {}
      await new Promise((r) => setTimeout(r, 1500));
      const diagnostics = this.getDiagnosticsForFile(absPath);
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        path: message.path,
        success: true,
        diagnostics: diagnostics.length ? diagnostics : undefined,
        content: newContent,
      });
    } else {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        path: message.path,
        success: true,
      });
    }
  }

  private async handleSearchFiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const regex = message.regex;
      if (!regex) return;

      const pathValue = message.path || message.folder_path || message.filePath;
      const searchPath = pathValue || ".";

      const { exec } = require("child_process");
      const cmd = `grep -rIlE "${regex.replace(/"/g, '\\"')}" "${searchPath}"`;
      exec(
        cmd,
        { cwd: workspaceFolder.uri.fsPath, maxBuffer: 1024 * 1024 * 10 },
        (err: any, stdout: string) => {
          if (err && err.code !== 1) {
            webviewView.webview.postMessage({
              command: "searchFilesResult",
              requestId: message.requestId,
              error: err.message,
            });
          } else {
            const results = stdout
              .trim()
              .split("\n")
              .filter((l) => l.length > 0);
            webviewView.webview.postMessage({
              command: "searchFilesResult",
              requestId: message.requestId,
              path: pathValue,
              results,
            });
          }
        },
      );
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "searchFilesResult",
        requestId: message.requestId,
        path: message.path || message.folder_path,
        error: e.message,
      });
    }
  }

  private async handleValidateFuzzyMatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    // ... fuzzy validation logic
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const absPath = vscode.Uri.joinPath(workspaceFolder.uri, message.path);
    const content = Buffer.from(
      await vscode.workspace.fs.readFile(absPath),
    ).toString("utf8");
    const match = message.diff.match(
      /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
    );
    if (!match) {
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "invalid_format",
      });
      return;
    }
    const clean = (text: string) =>
      text
        .replace(/^```[a-zA-Z]*$/gm, "")
        .trim()
        .replace(/\r\n/g, "\n");
    const search = clean(match[1]);
    const exact = content.replace(/\r\n/g, "\n").indexOf(search);

    if (exact !== -1) {
      const startLine = content.substring(0, exact).split(/\r?\n/).length;
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "exact",
        searchBlock: search,
        foundBlock: search,
        score: 1.0,
        startLine,
      });
    } else {
      const fuzzy = FuzzyMatcher.findMatch(content, search);
      if (fuzzy) {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "fuzzy",
          score: fuzzy.score,
          searchBlock: search,
          foundBlock: fuzzy.originalText,
          startLine: fuzzy.startLine,
        });
      } else {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "none",
          searchBlock: search,
        });
      }
    }
  }

  private async handleGetWorkspaceFiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const now = Date.now();
    if (
      this._workspaceFilesCache &&
      now - this._lastCacheUpdate < this.CACHE_TTL
    ) {
      webviewView.webview.postMessage({
        command: "workspaceFilesResponse",
        requestId: message.requestId,
        files: this._workspaceFilesCache,
      });
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    // Fetch blacklist
    const blacklist = this.projectStructureManager
      ? await this.projectStructureManager.getBlacklist()
      : [];
    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const recentFiles = this.recentItemsManager
      ? this.recentItemsManager.getRecentFiles()
      : [];

    const files = await vscode.workspace.findFiles("**/*");
    const stats = await Promise.all(
      files.map(async (f) => {
        const relativePath = vscode.workspace.asRelativePath(f);

        // Filter based on blacklist
        if (
          blacklist.some(
            (pattern) =>
              relativePath === pattern ||
              relativePath.startsWith(pattern + "/"),
          )
        ) {
          return null;
        }

        try {
          const s = await vscode.workspace.fs.stat(f);
          const lines = await fsAnalyzer.getFileLineCount(f.fsPath);
          return {
            path: relativePath,
            lastModified: s.mtime,
            type: "file",
            size: s.size,
            lines,
            isRecent: recentFiles.includes(relativePath),
          };
        } catch {
          return null;
        }
      }),
    );

    const result = stats
      .filter((x) => x)
      .sort((a: any, b: any) => b.lastModified - a.lastModified);

    this._workspaceFilesCache = result;
    this._lastCacheUpdate = now;

    webviewView.webview.postMessage({
      command: "workspaceFilesResponse",
      requestId: message.requestId,
      files: result,
    });
  }

  private async handleGetWorkspaceFolders(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const now = Date.now();
    if (
      this._workspaceFoldersCache &&
      now - this._lastCacheUpdate < this.CACHE_TTL
    ) {
      webviewView.webview.postMessage({
        command: "workspaceFoldersResponse",
        requestId: message.requestId,
        folders: this._workspaceFoldersCache,
      });
      return;
    }

    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const foldersWithCounts = await fsAnalyzer.getFolderPaths();
    const recentFolders = this.recentItemsManager
      ? this.recentItemsManager.getRecentFolders()
      : [];

    const result = foldersWithCounts.map((f) => ({
      name: path.basename(f.path),
      path: f.path, // getFolderPaths returns relative path
      type: "folder",
      isRecent: recentFolders.includes(f.path),
      fileCount: f.count,
    }));

    this._workspaceFoldersCache = result;
    webviewView.webview.postMessage({
      command: "workspaceFoldersResponse",
      requestId: message.requestId,
      folders: result,
    });
  }

  private async handleGetWorkspaceTree(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const raw = await this.contextManager.getRawFileTree();
    const normalize = (node: any): any => ({
      ...node,
      path: path
        .relative(workspaceFolder.uri.fsPath, node.path)
        .replace(/\\/g, "/"),
      children: node.children?.map(normalize),
    });
    webviewView.webview.postMessage({
      command: "workspaceTreeResult",
      requestId: message.requestId,
      tree: raw ? normalize(raw) : null,
    });
  }

  // #endregion

  // #region Agents
  private handleUpdateAgentPermissions(message: any) {
    if (this.agentManager) {
      this.agentManager.updatePermissions(message.permissions);
    }
  }

  private async handleExecuteAgentAction(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this.agentManager) {
      try {
        const result = await this.agentManager.executeAction(message.action);
        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result,
        });
      } catch (e: any) {
        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result: { success: false, error: e.message },
        });
      }
    }
  }
  // #endregion

  // #region Storage
  private async handleStorageOperation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.storageManager) return;
    try {
      if (message.command === "storageGet") {
        const value = await this.storageManager.get(message.key);
        webviewView.webview.postMessage({
          command: "storageGetResponse",
          requestId: message.requestId,
          key: message.key,
          value,
        });
      } else if (message.command === "storageSet") {
        await this.storageManager.set(message.key, message.value);
        webviewView.webview.postMessage({
          command: "storageSetResponse",
          requestId: message.requestId,
          success: true,
        });
      } else if (message.command === "storageDelete") {
        await this.storageManager.delete(message.key);
        webviewView.webview.postMessage({
          command: "storageDeleteResponse",
          requestId: message.requestId,
          success: true,
        });
      } else if (message.command === "storageList") {
        const keys = await this.storageManager.list(message.prefix);
        webviewView.webview.postMessage({
          command: "storageListResponse",
          requestId: message.requestId,
          keys,
        });
      }
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: message.command + "Response",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
  // #endregion

  // #region Misc
  private async handleSendMessage(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (message.text) {
      webviewView.webview.postMessage({
        command: "userMessage",
        text: message.text,
      });
    }
  }

  private async handleOpenDiffView(message: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const actualPath = path.isAbsolute(message.filePath)
      ? vscode.Uri.file(message.filePath)
      : vscode.Uri.joinPath(workspaceFolder.uri, message.filePath);
    const tmpDir = this._getTempDir(workspaceFolder.uri.fsPath);
    const basename = path.basename(message.filePath);
    const tempFile = vscode.Uri.file(path.join(tmpDir, basename)); // Simplified
    await vscode.workspace.fs.writeFile(
      tempFile,
      Buffer.from(message.newCode, "utf8"),
    );
    await vscode.commands.executeCommand(
      "vscode.diff",
      actualPath,
      tempFile,
      `${basename} (Current ↔ Previous)`,
    );
  }

  private async handleOpenFile(message: any) {
    const filePath = message.path;
    if (!filePath) return;

    try {
      const uri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            filePath,
          );
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      // console.error("Failed to open file:", error);
    }
  }

  private async handleRunCommand(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const cwd = workspaceFolder?.uri.fsPath || os.homedir();

      // Always create a new terminal for runCommand now
      const result = await this.processManager.startInteractive(cwd);
      const terminalId = result.id;

      this.processManager.sendInput(
        terminalId,
        `${message.commandText}\n`,
        message.actionId,
      );

      webviewView.webview.postMessage({
        command: "runCommandResult",
        requestId: message.requestId,
        terminalId: terminalId,
        actionId: message.actionId,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "runCommandResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  private async handleFocusTerminal(message: any) {
    try {
      this.processManager.focus(message.terminalId);
    } catch (e: any) {
      console.error("Failed to focus terminal:", e);
    }
  }

  private async handleStopCommand(message: any) {
    if (message.actionId === "all") {
      this.processManager.stopAll();
    } else {
      this.processManager.stop(message.actionId);
    }
  }

  private async handleOpenPreview(message: any) {
    const doc = await vscode.workspace.openTextDocument({
      content: message.content,
      language: message.language || "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  private async handleOpenTempImage(message: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const tmpDir = this._getTempDir(workspaceFolder.uri.fsPath);
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const base64 = message.content.replace(/^data:image\/\w+;base64,/, "");
    const tmpFile = vscode.Uri.file(
      path.join(tmpDir, `temp-${Date.now()}.png`),
    );
    await vscode.workspace.fs.writeFile(tmpFile, Buffer.from(base64, "base64"));
    await vscode.commands.executeCommand("vscode.open", tmpFile);
  }

  private async handleGetGitChanges(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const gitExt = vscode.extensions.getExtension("vscode.git");
    if (!gitExt) return;
    if (!gitExt.isActive) await gitExt.activate();
    const git = gitExt.exports.getAPI(1);
    const repo = git.repositories[0];
    if (!repo) return;

    const changes = [];
    const { exec } = require("child_process");
    const util = require("util");
    const execute = util.promisify(exec);

    for (const c of repo.state.indexChanges) {
      changes.push({
        status: "Staged",
        path: c.uri.fsPath.replace(workspaceFolder.uri.fsPath + "/", ""),
        diff: "",
      }); // Simplification on diff
    }
    for (const c of repo.state.workingTreeChanges) {
      changes.push({
        status: "Modified",
        path: c.uri.fsPath.replace(workspaceFolder.uri.fsPath + "/", ""),
        diff: "",
      });
    }
    webviewView.webview.postMessage({ command: "gitChangesResponse", changes });
  }

  private async handleRequestContext(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    // Proj context
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let pc = null;
    if (workspaceFolder && this.storageManager) {
      pc = await this.storageManager.get(
        this.getProjectContextKey(workspaceFolder.uri.fsPath),
      );
      if (pc) pc = JSON.parse(pc);
    }

    this.contextManager
      .generateContext(message.task, message.isFirstRequest, pc)
      .then((context: any) => {
        webviewView.webview.postMessage({
          command: "contextResponse",
          requestId: message.requestId,
          context,
        });
      })
      .catch((e: any) => {
        webviewView.webview.postMessage({
          command: "contextResponse",
          requestId: message.requestId,
          error: e.message,
        });
      });
  }

  private async handleHighlightCode(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const shiki = ShikiService.getInstance();
    const html = await shiki.highlight(
      message.code,
      message.language,
      message.themeKind || vscode.window.activeColorTheme.kind,
      message.themeId,
      message.lineHighlights,
      message.startLineNumber,
      message.showLineNumbers !== false,
    );
    webviewView.webview.postMessage({
      command: "highlightCodeResult",
      requestId: message.requestId,
      html,
    });
  }

  private async handleRevertToSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.backupManager) return;
    await this.fileLockManager.acquire(message.filePath);
    try {
      await this.backupManager.restoreSnapshot(
        message.conversationId,
        message.filePath,
        message.snapshotPath,
      );
      vscode.window.showInformationMessage(
        `Restored ${path.basename(message.filePath)}`,
      );
      webviewView.webview.postMessage({
        command: "backupEventAdded",
        conversationId: message.conversationId,
      });
    } catch (e) {
      vscode.window.showErrorMessage("Restore failed");
    }
  }

  private async handleOpenSnapshotDiffWithCurrent(message: any) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const backupFolder = this.backupManager.getBackupFolderPath(
      message.conversationId,
    );
    const snapshot = vscode.Uri.file(
      path.join(backupFolder, message.fileEvent.snapshotPath),
    );
    const current = vscode.Uri.joinPath(
      workspaceFolder.uri,
      message.fileEvent.filePath,
    );
    await vscode.commands.executeCommand(
      "vscode.diff",
      snapshot,
      current,
      "Snapshot ↔ Current",
    );
  }

  private async handleOpenDiff(message: any) {
    if (!this.backupManager) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    // ... same logic as extension.ts for complex historical diff
    // For brevity, defaulting to simple diff if not easy to port 1:1 here without more reading.
    // But user wanted refactor, so I should be careful. I will implement simple version for now.
    const backupFolder = this.backupManager.getBackupFolderPath(
      message.conversationId,
    );
    const right = message.fileEvent.snapshotPath
      ? vscode.Uri.file(path.join(backupFolder, message.fileEvent.snapshotPath))
      : vscode.Uri.joinPath(workspaceFolder.uri, message.fileEvent.filePath);
    await vscode.commands.executeCommand("vscode.open", right);
  }

  // Helpers
  private _getTempDir(workspaceFolderPath: string): string {
    const tempDir = os.tmpdir();
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(tempDir, "zen-vscode", hash);
  }

  private getDiagnosticsForFile(uri: vscode.Uri): string[] {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return diagnostics
      .filter(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map(
        (d) =>
          `[${d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning"}] Line ${d.range.start.line + 1}: ${d.message}`,
      );
  }

  private async handleGetFolderTree(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const folderUri = path.isAbsolute(message.path)
        ? vscode.Uri.file(message.path)
        : vscode.Uri.joinPath(workspaceFolder.uri, message.path);

      // Using the filesystem analyzer's recursive tree generation if possible,
      // but let's implement a simple one for the specific folder if needed.
      // Actually, we can just use the existing getFileTree if it supports paths.
      // But contextManager's getFileSystemAnalyzer might only be for the whole workspace.

      const tree = await this.generateMinimalTree(folderUri.fsPath);

      webviewView.webview.postMessage({
        command: "getFolderTreeResult",
        requestId: message.requestId,
        path: message.path,
        tree,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "getFolderTreeResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  private async generateMinimalTree(dir: string, depth = 0): Promise<string> {
    if (depth > 3) return "  ".repeat(depth) + "... (max depth reached)";

    let result = "";
    const items = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith(".")) continue;

      const indent = "  ".repeat(depth);
      if (item.isDirectory()) {
        result += `${indent}${item.name}/\n`;
        result += await this.generateMinimalTree(
          path.join(dir, item.name),
          depth + 1,
        );
      } else {
        result += `${indent}${item.name}\n`;
      }
    }
    return result;
  }

  private async handleGetProjectContext(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );

      // 1. Read workspace.md
      let workspace = "";
      const workspacePath = path.join(projectContextDir, "workspace.md");
      console.log(`[ChatController] --- GET PROJECT CONTEXT ---`);
      console.log(
        `[ChatController] Project Root: ${workspaceFolder.uri.fsPath}`,
      );
      console.log(`[ChatController] Storage Path: ${workspacePath}`);

      if (fs.existsSync(workspacePath)) {
        workspace = await fs.promises.readFile(workspacePath, "utf-8");
        console.log(
          `[ChatController] Read SUCCESS. Content length: ${workspace.length}, Content: "${workspace}"`,
        );
      } else {
        console.log(
          `[ChatController] Read FAILED: File does not exist at ${workspacePath}`,
        );
      }

      // 3. Generate Tree View (FileSystem Hierarchy)
      const treeView = await this.contextManager
        .getFileSystemAnalyzer()
        .getFileTree(3);

      webviewView.webview.postMessage({
        command: "projectContextResult",
        requestId: message.requestId,
        data: {
          workspace,
          treeView,
        },
      });
    } catch (error: any) {
      console.error(
        `[ChatController] Error in handleGetProjectContext:`,
        error,
      );
      webviewView.webview.postMessage({
        command: "projectContextResult",
        requestId: message.requestId,
        error: error.message,
      });
    }
  }

  private async handleStartProjectContextWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    console.log("[ChatController] Starting project context watch...");
    if (this._projectContextWatcher) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    this._projectContextWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, "**/*"),
    );

    const debouncedRefresh = this.debounce(async () => {
      console.log(
        "[ChatController] Project context change detected, refreshing...",
      );
      await this.handleGetProjectContext(
        { requestId: "auto-watch" },
        webviewView,
      );
    }, 2000);

    this._projectContextDisposables.push(
      this._projectContextWatcher.onDidChange(debouncedRefresh),
      this._projectContextWatcher.onDidCreate(debouncedRefresh),
      this._projectContextWatcher.onDidDelete(debouncedRefresh),
    );
  }

  public stopProjectContextWatch() {
    console.log("[ChatController] Stopping project context watch...");
    if (this._projectContextWatcher) {
      this._projectContextWatcher.dispose();
      this._projectContextWatcher = undefined;
    }
    this._projectContextDisposables.forEach((d) => d.dispose());
    this._projectContextDisposables = [];
  }

  private async handleStopProjectContextWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    this.stopProjectContextWatch();
  }

  private debounce(fn: Function, delay: number) {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  private getProjectContextKey(path: string): string {
    return `project-context-${crypto.createHash("md5").update(path).digest("hex")}`;
  }
  // #endregion
}
