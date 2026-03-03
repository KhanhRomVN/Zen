import * as vscode from "vscode";
import * as https from "https";
import { ContextManager } from "../context/ContextManager";
import { GlobalStorageManager } from "../storage-manager";
import { AgentCapabilityManager } from "../agent/AgentCapabilityManager";
import { BackupManager } from "../managers/BackupManager";
import { ProcessManager } from "../managers/ProcessManager";
import { FileLockManager } from "../managers/FileLockManager";
import { ProjectStructureManager } from "../context/ProjectStructureManager";
import { RecentItemsManager } from "../context/RecentItemsManager";
import { ConversationHandler } from "./handlers/ConversationHandler";
import { FileHandler } from "./handlers/FileHandler";
import { BackupHandler } from "./handlers/BackupHandler";
import { TerminalHandler } from "./handlers/TerminalHandler";
import { SystemHandler } from "./handlers/SystemHandler";
import { ProjectContextHandler } from "./handlers/ProjectContextHandler";
import { DiagnosticHandler } from "./handlers/DiagnosticHandler";
import { AgentHandler } from "./handlers/AgentHandler";
import { StorageHandler } from "./handlers/StorageHandler";

export class ChatController {
  private conversationHandler: ConversationHandler;
  private fileHandler: FileHandler;
  private backupHandler: BackupHandler;
  private terminalHandler: TerminalHandler;
  private systemHandler: SystemHandler;
  private projectContextHandler: ProjectContextHandler;
  private diagnosticHandler: DiagnosticHandler;
  private agentHandler: AgentHandler;
  private storageHandler: StorageHandler;

  private _pingInterval?: NodeJS.Timeout;

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
  ) {
    this.conversationHandler = new ConversationHandler(
      this.fileLockManager,
      this.backupManager,
    );
    this.fileHandler = new FileHandler(
      this.contextManager,
      this.fileLockManager,
      this.projectStructureManager,
      this.recentItemsManager,
    );
    this.backupHandler = new BackupHandler(this.backupManager);
    this.terminalHandler = new TerminalHandler(this.processManager);
    this.systemHandler = new SystemHandler();
    this.projectContextHandler = new ProjectContextHandler(
      this.contextManager,
      this.projectStructureManager,
      this.storageManager,
    );
    this.diagnosticHandler = new DiagnosticHandler(this.contextManager);
    this.agentHandler = new AgentHandler(this.agentManager);
    this.storageHandler = new StorageHandler(this.storageManager);
  }

  public async handleMessage(message: any, webviewView: vscode.WebviewView) {
    const command = message.command;

    try {
      switch (command) {
        // Theme & System
        case "requestTheme":
          await this.systemHandler.handleRequestTheme(webviewView);
          break;
        case "getSystemInfo":
          this.systemHandler.handleGetSystemInfo(message, webviewView);
          break;
        case "openWorkspaceFolder":
          await this.systemHandler.handleOpenWorkspaceFolder(message);
          break;
        case "openDiffView":
          await this.systemHandler.handleOpenDiffView(message);
          break;
        case "openFile":
        case "openWorkspaceFile":
          await this.systemHandler.handleOpenFile(message);
          break;
        case "openPreview":
          await this.systemHandler.handleOpenPreview(message);
          break;
        case "openTempImage":
          await this.systemHandler.handleOpenTempImage(message);
          break;
        case "openExternal":
          this.systemHandler.handleOpenExternal(message);
          break;

        // Conversation Management
        case "getHistory":
          await this.conversationHandler.handleGetHistory(message, webviewView);
          break;
        case "getConversation":
          await this.conversationHandler.handleGetConversation(
            message,
            webviewView,
          );
          break;
        case "logConversation":
          await this.conversationHandler.handleLogConversation(message);
          break;
        case "logChat":
          await this.conversationHandler.handleLogChat(message);
          break;
        case "createEmptyChatLog":
          await this.conversationHandler.handleCreateEmptyChatLog(message);
          break;
        case "deleteConversation":
          await this.conversationHandler.handleDeleteConversation(
            message,
            webviewView,
          );
          break;
        case "deleteAllConversations":
          await this.conversationHandler.handleDeleteAllConversations(
            message,
            webviewView,
          );
          break;
        case "rollbackConversationLog":
          await this.conversationHandler.handleRollbackConversationLog(message);
          break;
        case "renameConversationLog":
          await this.conversationHandler.handleRenameConversationLog(
            message,
            webviewView,
          );
          break;
        case "saveTerminalOutput":
          await this.conversationHandler.handleSaveTerminalOutput(message);
          break;
        case "readTerminalOutput":
          await this.conversationHandler.handleReadTerminalOutput(
            message,
            webviewView,
          );
          break;

        // File Operations
        case "readFile":
          await this.fileHandler.handleReadFile(message, webviewView);
          break;
        case "writeFile":
          await this.fileHandler.handleWriteFile(message, webviewView);
          break;
        case "replaceInFile":
          await this.fileHandler.handleReplaceInFile(message, webviewView);
          break;
        case "listFiles":
          await this.fileHandler.handleListFiles(message, webviewView);
          break;
        case "searchFiles":
          await this.fileHandler.handleSearchFiles(message, webviewView);
          break;
        case "askBypassGitignore":
          await this.fileHandler.handleAskBypassGitignore(message, webviewView);
          break;
        case "validateFuzzyMatch":
          await this.fileHandler.handleValidateFuzzyMatch(message, webviewView);
          break;
        case "getWorkspaceFiles":
          await this.fileHandler.handleGetWorkspaceFiles(message, webviewView);
          break;
        case "getWorkspaceFolders":
          await this.fileHandler.handleGetWorkspaceFolders(
            message,
            webviewView,
          );
          break;
        case "getWorkspaceTree":
          await this.fileHandler.handleGetWorkspaceTree(message, webviewView);
          break;
        case "getFileStats":
          await this.fileHandler.handleGetFileStats(message, webviewView);
          break;

        // Backup
        case "startBackupWatch":
          await this.backupHandler.handleStartBackupWatch(message, webviewView);
          break;
        case "stopBackupWatch":
          await this.backupHandler.handleStopBackupWatch(message, webviewView);
          break;
        case "getBackupTimeline":
          await this.backupHandler.handleGetBackupTimeline(
            message,
            webviewView,
          );
          break;
        case "getBackupSnapshot":
          await this.backupHandler.handleGetBackupSnapshot(
            message,
            webviewView,
          );
          break;
        case "getBackupBlacklist":
          await this.backupHandler.handleGetBackupBlacklist(
            message,
            webviewView,
          );
          break;
        case "addToBackupBlacklist":
          await this.backupHandler.handleAddToBackupBlacklist(
            message,
            webviewView,
          );
          break;
        case "removeFromBackupBlacklist":
          await this.backupHandler.handleRemoveFromBackupBlacklist(
            message,
            webviewView,
          );
          break;
        case "deleteBackupFile":
          await this.backupHandler.handleDeleteBackupFile(message, webviewView);
          break;
        case "backupBinaryFileDecision":
          await this.backupHandler.handleBackupBinaryFileDecision(
            message,
            webviewView,
          );
          break;
        case "revertToSnapshot":
          await this.backupHandler.handleRevertToSnapshot(message, webviewView);
          break;
        case "openSnapshotDiffWithCurrent":
          await this.backupHandler.handleOpenSnapshotDiffWithCurrent(message);
          break;
        case "openDiff":
          await this.systemHandler.handleOpenDiff(message);
          break;

        // Terminal
        case "runCommand":
          await this.terminalHandler.handleRunCommand(message, webviewView);
          break;
        case "attachTerminalToVSCode":
          this.terminalHandler.handleAttachTerminalToVSCode(message);
          break;
        case "terminalInput":
          this.terminalHandler.handleTerminalInput(message);
          break;
        case "focusTerminal":
          await this.terminalHandler.handleFocusTerminal(message);
          break;
        case "stopCommand":
          await this.terminalHandler.handleStopCommand(message);
          break;
        case "listTerminals":
          this.terminalHandler.handleListTerminals(message, webviewView);
          break;
        case "removeTerminal":
          this.terminalHandler.handleRemoveTerminal(message, webviewView);
          break;
        case "stopTerminal":
          this.terminalHandler.handleStopTerminal(message);
          break;

        // Project Context
        case "getProjectStructureBlacklist":
          await this.projectContextHandler.handleGetProjectStructureBlacklist(
            message,
            webviewView,
          );
          break;
        case "getFolderTree":
          await this.projectContextHandler.handleGetFolderTree(
            message,
            webviewView,
          );
          break;
        case "getProjectContext":
          await this.projectContextHandler.handleGetProjectContext(
            message,
            webviewView,
          );
          break;
        case "startProjectContextWatch":
          await this.projectContextHandler.handleStartProjectContextWatch(
            message,
            webviewView,
          );
          break;
        case "stopProjectContextWatch":
          await this.projectContextHandler.handleStopProjectContextWatch(
            message,
            webviewView,
          );
          break;

        // Diagnostics
        case "getSymbolDefinition":
          await this.diagnosticHandler.handleGetSymbolDefinition(
            message,
            webviewView,
          );
          break;
        case "getReferences":
          await this.diagnosticHandler.handleGetReferences(
            message,
            webviewView,
          );
          break;
        case "getFileOutline":
          await this.diagnosticHandler.handleGetFileOutline(
            message,
            webviewView,
          );
          break;
        case "highlightCode":
          await this.diagnosticHandler.handleHighlightCode(
            message,
            webviewView,
          );
          break;

        // Misc & Core (kept in Controller for now if simple)
        case "confirmDelete":
        case "confirmClearAll":
        case "confirmClearChat":
          await this.systemHandler.handleConfirmation(message, webviewView);
          break;
        case "showError":
          vscode.window.showErrorMessage(message.message);
          break;
        case "updateAgentPermissions":
          this.agentHandler.handleUpdateAgentPermissions(message);
          break;
        case "executeAgentAction":
          await this.agentHandler.handleExecuteAgentAction(
            message,
            webviewView,
          );
          break;
        case "storageGet":
        case "storageSet":
        case "storageDelete":
        case "storageList":
          await this.storageHandler.handleStorageOperation(
            message,
            webviewView,
          );
          break;
        case "sendMessage":
          await this.conversationHandler.handleSendMessage(
            message,
            webviewView,
          );
          break;
        case "getGitChanges":
          await this.fileHandler.handleGetGitChanges(message, webviewView);
          break;
        case "requestContext":
          await this.projectContextHandler.handleRequestContext(
            message,
            webviewView,
          );
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
      try {
        const req = https.get(
          "https://www.google.com/generate_204",
          { timeout: 3000 },
          (res) => {
            const end = Date.now();
            const latency = end - start;
            webview.postMessage({
              command: "networkPingUpdate",
              ping: latency,
            });
            res.resume();
          },
        );
        req.on("error", () => {
          webview.postMessage({ command: "networkPingUpdate", ping: null });
        });
        req.on("timeout", () => {
          req.destroy();
          webview.postMessage({ command: "networkPingUpdate", ping: null });
        });
        req.end();
      } catch (e) {
        webview.postMessage({ command: "networkPingUpdate", ping: null });
      }
    };
    checkPing();
    this._pingInterval = setInterval(checkPing, 10000);
  }

  public stopPingService() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = undefined;
    }
  }

  public async updateTheme(webview: vscode.Webview) {
    await this.systemHandler.updateTheme(webview);
  }

  public stopProjectContextWatch() {
    this.projectContextHandler.stopProjectContextWatch();
  }
}
