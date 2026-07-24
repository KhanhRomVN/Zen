/**
 *? Usage:
 *    Đọc nội dung một cuộc hội thoại từ file JSON, hỗ trợ fallback search trong thư mục projects.
 *
 *? Function:
 *    handleGetConversation(): Đọc nội dung một cuộc hội thoại từ file JSON.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// SERVICES
import { PathService } from "../../services/PathService";

// STORAGE
import { GlobalStorageManager } from "../../storage/GlobalStorageManager";

export class GetConversationHandler {
  private pathService: PathService;

  constructor(private storageManager?: GlobalStorageManager) {
    this.pathService = PathService.getInstance();
  }

  private getContextRoot(): string {
    return this.pathService.getContextRoot();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
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
            `[GetConversationHandler] fallback search error:`,
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
}