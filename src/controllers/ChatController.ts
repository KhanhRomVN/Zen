import * as vscode from "vscode";
import { ContextManager } from "../context/ContextManager";
import { GlobalStorageManager } from "../storage-manager";
import { AgentCapabilityManager } from "../agent/AgentCapabilityManager";
import { ProcessManager } from "../managers/ProcessManager";
import { FileLockManager } from "../managers/FileLockManager";
import { RecentItemsManager } from "../context/RecentItemsManager";
import { ConversationHandler } from "./handlers/ConversationHandler";
import { FileHandler } from "./handlers/FileHandler";
import { TerminalHandler } from "./handlers/TerminalHandler";
import { SystemHandler } from "./handlers/SystemHandler";
import { ProjectContextHandler } from "./handlers/ProjectContextHandler";
import { AgentHandler } from "./handlers/AgentHandler";
import { StorageHandler } from "./handlers/StorageHandler";
import { CheckpointManager } from "../utils/CheckpointManager";

export class ChatController {
  private conversationHandler: ConversationHandler;
  private fileHandler: FileHandler;
  private terminalHandler: TerminalHandler;
  private systemHandler: SystemHandler;
  private projectContextHandler: ProjectContextHandler;
  private agentHandler: AgentHandler;
  private storageHandler: StorageHandler;

  constructor(
    private contextManager: ContextManager,
    private storageManager: GlobalStorageManager | undefined,
    private agentManager: AgentCapabilityManager | undefined,
    private processManager: ProcessManager,
    private fileLockManager: FileLockManager,
    private recentItemsManager: RecentItemsManager | undefined,
    private extensionUri: vscode.Uri,
  ) {
    this.conversationHandler = new ConversationHandler(this.fileLockManager);
    this.fileHandler = new FileHandler(
      this.contextManager,
      this.fileLockManager,
      this.recentItemsManager,
    );
    this.terminalHandler = new TerminalHandler(this.processManager);
    this.systemHandler = new SystemHandler();
    this.projectContextHandler = new ProjectContextHandler(
      this.contextManager,
      this.storageManager,
    );
    this.agentHandler = new AgentHandler(this.agentManager);
    this.storageHandler = new StorageHandler(this.storageManager);
  }

  public async handleMessage(message: any, webviewView: vscode.WebviewView) {
    const command = message.command;

    if (message.conversationId) {
      CheckpointManager.getInstance().setActiveConversationId(
        message.conversationId,
      );
    } else if (message.chatUuid) {
      CheckpointManager.getInstance().setActiveConversationId(message.chatUuid);
    }

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
        case "openFolder":
          await this.systemHandler.handleOpenFolder(message);
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
        case "revertConversation":
          await this.conversationHandler.handleRevertConversation(
            message,
            webviewView,
          );
          break;
        case "openConversationFolder":
          await this.conversationHandler.handleOpenConversationFolder(message);
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
        case "searchContent":
          // removed
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
        case "deleteFile":
          await this.fileHandler.handleDeleteFile(message, webviewView);
          break;
        case "deleteFolder":
          await this.fileHandler.handleDeleteFolder(message, webviewView);
          break;

        // Backup
        case "startBackupWatch":
        case "stopBackupWatch":
        case "getBackupTimeline":
        case "getBackupSnapshot":
        case "getBackupBlacklist":
        case "addToBackupBlacklist":
        case "removeFromBackupBlacklist":
        case "deleteBackupFile":
        case "backupBinaryFileDecision":
        case "revertToSnapshot":
        case "openSnapshotDiffWithCurrent":
          // Backup feature removed
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
    } catch (error) {}
  }

  public async updateTheme(webview: vscode.Webview) {
    await this.systemHandler.updateTheme(webview);
  }
}
