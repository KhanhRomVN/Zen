/**
 *? Usage:
 *    Controller trung tâm nhận message từ webview, điều phối đến các handler tương ứng (file, terminal, git, agent, storage, conversation...).
 *
 *? Function:
 *    handleMessage() : Routing chính, phân phối message theo command.
 *    updateTheme()   : Gửi theme hiện tại cho webview.
 */
import * as vscode from "vscode";

// AGENT
import { AgentManager } from "../agent/AgentManager";

// HANDLERS
import { AgentHandler } from "../handlers/AgentHandler";
import { ProjectContextHandler } from "../handlers/system/ProjectContextHandler";
import { StorageHandler } from "../handlers/storage/StorageHandler";
import { ThemeHandler } from "../handlers/system/ThemeHandler";
import { FileOpenHandler } from "../handlers/system/FileOpenHandler";
import { DiffViewHandler } from "../handlers/system/DiffViewHandler";
import { PreviewHandler } from "../handlers/system/PreviewHandler";
import { GitCommitHandler } from "../handlers/git/GitCommitHandler";
import { RemoveTerminalHandler } from "../handlers/terminal/RemoveTerminalHandler";
import { RunCommandHandler } from "../handlers/terminal/RunCommandHandler";
import { StopCommandHandler } from "../handlers/terminal/StopCommandHandler";
import { StopTerminalHandler } from "../handlers/terminal/StopTerminalHandler";
import { TerminalInputHandler } from "../handlers/terminal/TerminalInputHandler";
import { DeleteAllConversationsHandler } from "../handlers/conversation/DeleteAllConversationsHandler";
import { DeleteConversationHandler } from "../handlers/conversation/DeleteConversationHandler";
import { GetConversationHandler } from "../handlers/conversation/GetConversationHandler";
import { GetHistoryHandler } from "../handlers/conversation/GetHistoryHandler";
import { OpenConversationFolderHandler } from "../handlers/conversation/OpenConversationFolderHandler";
import { RevertConversationHandler } from "../handlers/conversation/RevertConversationHandler";
import { SaveConversationStateHandler } from "../handlers/conversation/SaveConversationStateHandler";
import { DeleteFileHandler } from "../handlers/tool/DeleteFileHandler";
import { FileMiscHandler } from "../handlers/tool/FileMiscHandler";
import { FindFilesHandler } from "../handlers/tool/FindFilesHandler";
import { ListFilesHandler } from "../handlers/tool/ListFilesHandler";
import { MoveFileHandler } from "../handlers/tool/MoveFileHandler";
import { ReadFileHandler } from "../handlers/tool/ReadFileHandler";
import { ReplaceInFileHandler } from "../handlers/tool/ReplaceInFileHandler";
import { RevertFileHandler } from "../handlers/tool/RevertFileHandler";
import { ViewReplaceHistoryHandler } from "../handlers/tool/ViewReplaceHistoryHandler";
import { WriteToFileHandler } from "../handlers/tool/WriteToFileHandler";
import { GitDiffHandler } from "../handlers/tool/GitDiffHandler";
import { GitStatusHandler } from "../handlers/tool/GitStatusHandler";

// MANAGERS
import { CheckpointManager } from "../managers/CheckpointManager";
import { FileLockManager } from "../managers/FileLockManager";
import { ProcessManager } from "../managers/ProcessManager";

// STORAGE
import { GlobalStorageManager } from "../storage/GlobalStorageManager";

export class ChatController {
  private getHistoryHandler: GetHistoryHandler;
  private getConversationHandler: GetConversationHandler;
  private deleteConversationHandler: DeleteConversationHandler;
  private deleteAllConversationsHandler: DeleteAllConversationsHandler;
  private openConversationFolderHandler: OpenConversationFolderHandler;
  private saveConversationStateHandler: SaveConversationStateHandler;
  private revertConversationHandler: RevertConversationHandler;
  private readFileHandler: ReadFileHandler;
  private writeToFileHandler: WriteToFileHandler;
  private replaceInFileHandler: ReplaceInFileHandler;
  private deleteFileHandler: DeleteFileHandler;
  private moveFileHandler: MoveFileHandler;
  private revertFileHandler: RevertFileHandler;
  private viewReplaceHistoryHandler: ViewReplaceHistoryHandler;
  private listFilesHandler: ListFilesHandler;
  private findFilesHandler: FindFilesHandler;
  private fileMiscHandler: FileMiscHandler;
  private gitStatusHandler: GitStatusHandler;
  private gitDiffHandler: GitDiffHandler;
  private runCommandHandler: RunCommandHandler;
  private stopCommandHandler: StopCommandHandler;
  private terminalInputHandler: TerminalInputHandler;
  private removeTerminalHandler: RemoveTerminalHandler;
  private stopTerminalHandler: StopTerminalHandler;
  private themeHandler: ThemeHandler;
  private fileOpenHandler: FileOpenHandler;
  private diffViewHandler: DiffViewHandler;
  private previewHandler: PreviewHandler;
  private gitCommitHandler: GitCommitHandler;
  private projectContextHandler: ProjectContextHandler;
  private agentHandler: AgentHandler;
  private storageHandler: StorageHandler;

  constructor(
    private storageManager: GlobalStorageManager | undefined,
    private agentManager: AgentManager | undefined,
    private processManager: ProcessManager,
    private fileLockManager: FileLockManager,
  ) {
    this.getHistoryHandler = new GetHistoryHandler(this.storageManager);
    this.getConversationHandler = new GetConversationHandler(
      this.storageManager,
    );
    this.deleteConversationHandler = new DeleteConversationHandler();
    this.deleteAllConversationsHandler = new DeleteAllConversationsHandler();
    this.openConversationFolderHandler = new OpenConversationFolderHandler();
    this.saveConversationStateHandler = new SaveConversationStateHandler(
      this.fileLockManager,
    );
    this.revertConversationHandler = new RevertConversationHandler(
      this.fileLockManager,
    );
    this.readFileHandler = new ReadFileHandler();
    this.writeToFileHandler = new WriteToFileHandler(this.fileLockManager);
    this.replaceInFileHandler = new ReplaceInFileHandler(this.fileLockManager);
    this.deleteFileHandler = new DeleteFileHandler();
    this.moveFileHandler = new MoveFileHandler();
    this.revertFileHandler = new RevertFileHandler();
    this.viewReplaceHistoryHandler = new ViewReplaceHistoryHandler();
    this.listFilesHandler = new ListFilesHandler();
    this.findFilesHandler = new FindFilesHandler();
    this.fileMiscHandler = new FileMiscHandler();
    this.gitStatusHandler = new GitStatusHandler();
    this.gitDiffHandler = new GitDiffHandler();
    this.runCommandHandler = new RunCommandHandler(this.processManager);
    this.stopCommandHandler = new StopCommandHandler(this.processManager);
    this.terminalInputHandler = new TerminalInputHandler(this.processManager);
    this.removeTerminalHandler = new RemoveTerminalHandler(this.processManager);
    this.stopTerminalHandler = new StopTerminalHandler(this.processManager);
    this.themeHandler = new ThemeHandler();
    this.fileOpenHandler = new FileOpenHandler();
    this.diffViewHandler = new DiffViewHandler();
    this.previewHandler = new PreviewHandler();
    this.gitCommitHandler = new GitCommitHandler();
    this.projectContextHandler = new ProjectContextHandler();
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
          await this.themeHandler.handleRequestTheme(webviewView);
          break;
        case "getSystemInfo":
          this.projectContextHandler.handleGetSystemInfo(message, webviewView);
          break;
        case "openFile":
          await this.fileOpenHandler.handleOpenFile(message);
          break;
        case "openFolder":
          await this.fileOpenHandler.handleOpenFolder(message);
          break;
        case "openTempImage":
          await this.previewHandler.handleOpenTempImage(message);
          break;

        // Conversation Management
        case "getHistory":
          await this.getHistoryHandler.handleGetHistory(message, webviewView);
          break;
        case "getConversation":
          await this.getConversationHandler.handleGetConversation(
            message,
            webviewView,
          );
          break;

        case "deleteConversation":
          await this.deleteConversationHandler.handleDeleteConversation(
            message,
            webviewView,
          );
          break;
        case "deleteAllConversations":
          await this.deleteAllConversationsHandler.handleDeleteAllConversations(
            message,
            webviewView,
          );
          break;
        case "revertConversation":
          await this.revertConversationHandler.handleRevertConversation(
            message,
            webviewView,
          );
          break;
        case "openConversationFolder":
          await this.openConversationFolderHandler.handleOpenConversationFolder(
            message,
          );
          break;

        case "saveConversationState":
          await this.saveConversationStateHandler.handleSaveConversationState(
            message,
          );
          break;
        // File Operations
        case "readFile":
          await this.readFileHandler.handleReadFile(message, webviewView);
          break;
        case "writeFile":
          await this.writeToFileHandler.handleWriteToFile(message, webviewView);
          break;
        case "replaceInFile":
          await this.replaceInFileHandler.handleReplaceInFile(
            message,
            webviewView,
          );
          break;
        case "revertFile":
          await this.revertFileHandler.handleRevertFile(message, webviewView);
          break;
        case "viewReplaceHistory":
          await this.viewReplaceHistoryHandler.handleViewReplaceHistory(
            message,
            webviewView,
          );
          break;
        case "listFiles":
          await this.listFilesHandler.handleListFiles(message, webviewView);
          break;
        case "findFiles":
          await this.findFilesHandler.handleFindFiles(message, webviewView);
          break;

        case "validateFuzzyMatch":
          await this.replaceInFileHandler.handleValidateFuzzyMatch(
            message,
            webviewView,
          );
          break;
        case "getFileStats":
          await this.fileMiscHandler.handleGetFileStats(message, webviewView);
          break;
        case "getDiagnostics":
        case "deleteFile":
          await this.deleteFileHandler.handleDeleteFile(message, webviewView);
          break;
        case "moveFile":
          await this.moveFileHandler.handleMoveFile(message, webviewView);
          break;
        case "openFileDiff":
          await this.diffViewHandler.handleFileDiff(message);
          break;
        case "openWriteToFile":
          await this.previewHandler.handleOpenWriteToFile(message);
          break;

        // Terminal
        case "runCommand":
          await this.runCommandHandler.handleRunCommand(message, webviewView);
          break;
        case "terminalInput":
          this.terminalInputHandler.handleTerminalInput(message);
          break;
        case "stopCommand":
          await this.stopCommandHandler.handleStopCommand(message);
          break;
        case "removeTerminal":
          this.removeTerminalHandler.handleRemoveTerminal(message, webviewView);
          break;
        case "stopTerminal":
          this.stopTerminalHandler.handleStopTerminal(message);
          break;

        // Project Context
        case "getProjectContext":
          await this.projectContextHandler.handleGetProjectContext(
            message,
            webviewView,
          );
          break;
        case "showError":
          vscode.window.showErrorMessage(message.message);
          break;
        case "executeGrep":
          await this.agentHandler.handleExecuteGrep(message, webviewView);
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
        case "runGitStatus":
          await this.gitStatusHandler.handleRunGitStatus(message, webviewView);
          break;
        case "gitDiff":
          await this.gitDiffHandler.handleGitDiff(message, webviewView);
          break;
        case "showGitDiff":
          await this.diffViewHandler.handleShowGitDiff(message);
          break;

        case "acceptCommitMessage":
          await this.gitCommitHandler.handleGitCommit(message, webviewView);
          break;
      }
    } catch (error) {
      console.error("[ChatController] handleMessage error:", error);
    }
  }

  public async updateTheme(webview: vscode.Webview) {
    await this.themeHandler.updateTheme(webview);
  }
}
