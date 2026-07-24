/**
 *? Usage:
 *    Xem lịch sử các lần replace_in_file cho một file.
 *
 *? Function:
 *    handleViewReplaceHistory(): Trả về lịch sử các lần replace_in_file cho một file.
 */
import * as vscode from "vscode";
import * as path from "path";

// MANAGERS
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";

export class ViewReplaceHistoryHandler {
  public async handleViewReplaceHistory(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    try {
      const { filePath, conversationId, requestId } = message;
      if (!filePath) throw new Error("filePath is required");
      if (!conversationId) throw new Error("conversationId is required");

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder");

      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);

      const historyManager = ReplaceInFileHistoryManager.getInstance();
      historyManager.setActiveConversationId(conversationId);

      const histories = await historyManager.getHistoryList(absPath);

      webviewView.webview.postMessage({
        command: "viewReplaceHistoryResult",
        requestId,
        filePath,
        histories,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "viewReplaceHistoryResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}