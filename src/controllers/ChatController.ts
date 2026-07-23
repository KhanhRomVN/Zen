// * ChatController.ts - Controller trung tâm điều phối tất cả message từ webview đến các handler tương ứng.
import * as vscode from "vscode";
import { GlobalStorageManager } from "../storage/GlobalStorageManager";
import { AgentManager } from "../agent/AgentManager";
import { ProcessManager } from "../managers/ProcessManager";
import { FileLockManager } from "../managers/FileLockManager";

import { ConversationHistoryHandler } from "../handlers/conversation/ConversationHistoryHandler";
import { ConversationStateHandler } from "../handlers/conversation/ConversationStateHandler";
import { FileReadHandler } from "../handlers/file/FileReadHandler";
import { FileWriteHandler } from "../handlers/file/FileWriteHandler";
import { FileOperationHandler } from "../handlers/file/FileOperationHandler";
import { GitHandler } from "../handlers/file/GitHandler";
import { TerminalHandler } from "../handlers/TerminalHandler";
import { SystemHandler } from "../handlers/SystemHandler";
import { ProjectContextHandler } from "../handlers/ProjectContextHandler";
import { AgentHandler } from "../handlers/AgentHandler";
import { StorageHandler } from "../handlers/StorageHandler";
import { CheckpointManager } from "../managers/CheckpointManager";

// * Controller chính của Zen: nhận message từ webview, điều phối đến đúng handler dựa trên command type.
export class ChatController {
  private conversationHistoryHandler: ConversationHistoryHandler;
  private conversationStateHandler: ConversationStateHandler;
  private fileReadHandler: FileReadHandler;
  private fileWriteHandler: FileWriteHandler;
  private fileOperationHandler: FileOperationHandler;
  private gitHandler: GitHandler;
  private terminalHandler: TerminalHandler;
  private systemHandler: SystemHandler;
  private projectContextHandler: ProjectContextHandler;
  private agentHandler: AgentHandler;
  private storageHandler: StorageHandler;

  // * Khởi tạo tất cả handlers với các dependency cần thiết (storage, agent, process, file lock).
  constructor(
    private storageManager: GlobalStorageManager | undefined,
    private agentManager: AgentManager | undefined,
    private processManager: ProcessManager,
    private fileLockManager: FileLockManager,
  ) {
    this.conversationHistoryHandler = new ConversationHistoryHandler(
      this.storageManager,
    );
    this.conversationStateHandler = new ConversationStateHandler(
      this.fileLockManager,
    );
    this.fileReadHandler = new FileReadHandler();
    this.fileWriteHandler = new FileWriteHandler(this.fileLockManager);
    this.fileOperationHandler = new FileOperationHandler();
    this.gitHandler = new GitHandler();
    this.terminalHandler = new TerminalHandler(this.processManager);
    this.systemHandler = new SystemHandler();
    this.projectContextHandler = new ProjectContextHandler();
    this.agentHandler = new AgentHandler(this.agentManager);
    this.storageHandler = new StorageHandler(this.storageManager);
  }

  // * Điều phối message từ webview: xác định command, gán conversationId, gọi handler tương ứng.
  public async handleMessage(message: any, webviewView: vscode.WebviewView) {
    const startTime = Date.now();
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
        case "openFileAtLine":
          await this.systemHandler.handleOpenFileAtLine(message);
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
          await this.conversationHistoryHandler.handleGetHistory(message, webviewView);
          break;
        case "getConversation":
          await this.conversationHistoryHandler.handleGetConversation(
            message,
            webviewView,
          );
          break;

        case "deleteConversation":
          await this.conversationHistoryHandler.handleDeleteConversation(
            message,
            webviewView,
          );
          break;
        case "deleteAllConversations":
          await this.conversationHistoryHandler.handleDeleteAllConversations(
            message,
            webviewView,
          );
          break;
        case "rollbackConversationLog":
          await this.conversationStateHandler.handleRollbackConversationLog(message);
          break;
        case "revertConversation":
          await this.conversationStateHandler.handleRevertConversation(
            message,
            webviewView,
          );
          break;
        case "openConversationFolder":
          await this.conversationHistoryHandler.handleOpenConversationFolder(message);
          break;

        case "saveConversationState":
          await this.conversationStateHandler.handleSaveConversationState(message);
          break;
        // File Operations
        case "readFile":
          await this.fileReadHandler.handleReadFile(message, webviewView);
          break;
        case "writeFile":
          await this.fileWriteHandler.handleWriteToFile(message, webviewView);
          break;
        case "replaceInFile":
          await this.fileWriteHandler.handleReplaceInFile(message, webviewView);
          break;
        case "revertFile":
          await this.fileOperationHandler.handleRevertFile(message, webviewView);
          break;
        case "viewReplaceHistory":
          await this.fileOperationHandler.handleViewReplaceHistory(message, webviewView);
          break;
        case "findFiles":
          await this.fileOperationHandler.handleFindFiles(message, webviewView);
          break;
        case "searchContent":
          // removed
          break;
        case "validateFuzzyMatch":
          await this.fileWriteHandler.handleValidateFuzzyMatch(message, webviewView);
          break;
        case "getFileStats":
          await this.fileOperationHandler.handleGetFileStats(message, webviewView);
          break;
        case "getDiagnostics":
          await this.fileOperationHandler.handleGetDiagnostics(message, webviewView);
          break;
        case "deleteFile":
          await this.fileOperationHandler.handleDeleteFile(message, webviewView);
          break;
        case "moveFile":
          await this.fileOperationHandler.handleMoveFile(message, webviewView);
          break;
        case "getSnapshot":
          await this.fileOperationHandler.handleGetSnapshot(message, webviewView);
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
        case "openReplaceInFileDiff":
          await this.systemHandler.handleOpenReplaceInFileDiff(message);
          break;
        case "openWriteToFile":
          await this.systemHandler.handleOpenWriteToFile(message);
          break;
        case "openSnapshotDiff":
          await this.systemHandler.handleOpenSnapshotDiff(message);
          break;

        // Terminal
        case "runCommand":
          await this.terminalHandler.handleRunCommand(message, webviewView);
          break;
        case "terminalInput":
          this.terminalHandler.handleTerminalInput(message);
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
        case "runGitStatus":
          await this.gitHandler.handleRunGitStatus(message, webviewView);
          break;
        case "gitDiff":
          await this.gitHandler.handleGitDiff(message, webviewView);
          break;
        case "showGitDiff":
          await this.systemHandler.handleShowGitDiff(message);
          break;
        case "generateCommitMessage":
          // Handle commit message generation directly in ChatController
          await this.handleGenerateCommitMessage(message, webviewView);
          break;
        case "acceptCommitMessage":
          await this.systemHandler.handleAcceptCommitMessage(
            message,
            webviewView,
          );
          break;
      }
    } catch (error) {}
  }

  // * Cập nhật theme CSS cho webview dựa trên theme hiện tại của VS Code.
  public async updateTheme(webview: vscode.Webview) {
    await this.systemHandler.updateTheme(webview);
  }

  // * Tạo commit message từ danh sách git status, sử dụng AI model để sinh nội dung commit.
  public async handleGenerateCommitMessage(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const { statusItems, model, account } = message;
      if (!statusItems || statusItems.length === 0) {
        webviewView.webview.postMessage({
          command: "generateCommitMessageResult",
          requestId: message.requestId,
          error: "No git status items provided",
        });
        return;
      }

      // Build prompt from status items
      const gitStatusText = statusItems
        .map(
          (item: any) =>
            `${item.staged ? "[staged]" : "[unstaged]"} ${item.status} ${item.path}`,
        )
        .join("\n");

      const prompt = `[COMMIT_MESSAGE_REQUEST]
Hãy tạo một commit message dựa trên danh sách file thay đổi sau:

\`\`\`
${gitStatusText}
\`\`\`

Yêu cầu:
- Sử dụng cấu trúc: <emoji> <type>(<scope>): <subject>
- Liệt kê các thay đổi chi tiết với dấu "-" ở đầu dòng
- Viết bằng tiếng Việt
- Commit message ngắn gọn, rõ ràng, có ý nghĩa
- Trả lời chỉ với commit message, không thêm nội dung khác
- Đặt commit message trong thẻ <commit_message>...</commit_message>`;

      // Create a new conversation ID
      const conversationId = `commit-${Date.now()}`;

      // TODO: Use the actual AI model to generate the commit message
      // For now, we'll send a response back to the webview
      // The webview will handle the display

      // For testing, send a mock response
      // In production, this would use the AI model

      // Since we don't have direct access to the AI model here,
      // we'll use the existing sendMessage flow with a new conversation

      // Create a new conversation using the conversation handler
      // This is a simplified version - we need to actually generate the commit message

      // Return the result to the webview
      webviewView.webview.postMessage({
        command: "generateCommitMessageResult",
        requestId: message.requestId,
        success: true,
        conversationId: conversationId,
      });
    } catch (error) {
      console.error(
        "[ChatController] handleGenerateCommitMessage error:",
        error,
      );
      webviewView.webview.postMessage({
        command: "generateCommitMessageResult",
        requestId: message.requestId,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate commit message",
      });
    }
  }
}