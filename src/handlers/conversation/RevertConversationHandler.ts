/**
 *? Usage:
 *    Khôi phục hội thoại về trước một message, kèm checkpoint để có thể undo.
 *
 *? Function:
 *    handleRevertConversation(): Khôi phục hội thoại về trước một message, kèm checkpoint.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";

// SERVICES
import { PathService } from "../../services/PathService";

/**
 * Parse actions from message content (markdown format)
 * Extracts tool actions like [replace_in_file for 'file.txt']
 */
function parseActionsFromContent(content: string): Array<{
  type: string;
  filePath?: string;
  actionId?: string;
}> {
  const actions: Array<{ type: string; filePath?: string; actionId?: string }> =
    [];

  // Pattern: [tool_name for 'file_path']
  const toolPattern = /\[(\w+)\s+for\s+'([^']+)'\]/g;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    const toolName = match[1];
    const filePath = match[2];

    if (toolName === "replace_in_file") {
      actions.push({
        type: "replace_in_file",
        filePath,
      });
    }
  }

  return actions;
}

export class RevertConversationHandler {
  private pathService: PathService;

  constructor(private fileLockManager: FileLockManager) {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  /**
   * Resolve a file path (possibly relative) to an absolute path using the workspace folder.
   */
  private resolveToAbsolute(
    workspaceFolder: vscode.WorkspaceFolder,
    filePath: string,
  ): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(workspaceFolder.uri.fsPath, filePath);
  }

  public async handleRevertConversation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.warn("[REVERT-DEBUG] No workspace folder found");
        return;
      }
      const { conversationId, messageId, timestamp } = message;
      if (!conversationId || !messageId) {
        console.warn("[REVERT-DEBUG] Missing conversationId or messageId", {
          conversationId,
          messageId,
        });
        return;
      }

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );
      const logPath = path.join(projectContextDir, `${conversationId}.json`);

      if (!fs.existsSync(logPath)) {
        console.error("[REVERT-DEBUG] Log file not found:", logPath);
        throw new Error(`Log file not found: ${logPath}`);
      }

      const release = await this.fileLockManager.acquire(logPath);
      try {
        const fileData = await fs.promises.readFile(logPath, "utf-8");

        let parsed;
        try {
          parsed = JSON.parse(fileData);
        } catch (parseErr: any) {
          console.error("[REVERT-DEBUG] JSON parse error:", parseErr.message);
          throw new Error(`Failed to parse log file: ${parseErr.message}`);
        }

        let content: any[];
        if (Array.isArray(parsed)) {
          content = parsed;
        } else if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.messages)
        ) {
          content = parsed.messages;
        } else {
          console.error(
            "[REVERT-DEBUG] Invalid conversation log format, type:",
            typeof parsed,
            "value:",
            JSON.stringify(parsed).substring(0, 100),
          );
          throw new Error("Invalid conversation log format");
        }

        if (content.length === 0) {
          webviewView.webview.postMessage({
            command: "conversationReverted",
            conversationId,
          });
          return;
        }

        const index = content.findIndex((m: any) => m.id === messageId);
        if (index === -1) {
          console.error(
            "[REVERT-DEBUG] Message not found in history. Available IDs:",
            content.map((m: any) => m.id),
          );
          throw new Error(`Message with ID ${messageId} not found in history`);
        }

        const targetMsg = content[index];
        const revertTimestamp =
          typeof targetMsg.timestamp === "string"
            ? new Date(targetMsg.timestamp).getTime()
            : targetMsg.timestamp || timestamp;

        // Calculate revertResponseNumber: count assistant messages up to and including the target message
        let revertResponseNumber = 0;
        for (let i = 0; i <= index; i++) {
          if (content[i].role === "assistant") {
            revertResponseNumber++;
          }
        }

        const messagesToDelete = content.slice(index);
        const filePaths = new Set<string>();
        // Track response number while iterating (continuing from revertResponseNumber for deleted messages)
        let currentResponseNumber = revertResponseNumber;

        for (const msg of messagesToDelete) {
          // Check tool result messages (role=user with -tool in id)
          const isToolMessage = msg.role === "user" && msg.id.includes("-tool");

          // Also check assistant messages that might contain actions
          const isAssistantMessage = msg.role === "assistant";

          if (isAssistantMessage) {
            currentResponseNumber++;
          }

          if ((isToolMessage || isAssistantMessage) && msg.content) {
            const parsedActions = parseActionsFromContent(msg.content);

            for (const action of parsedActions) {
              if (action.type === "replace_in_file" && action.filePath) {
                // Resolve relative path to absolute for consistent hashing with saveHistory
                const absolutePath = this.resolveToAbsolute(
                  workspaceFolder,
                  action.filePath,
                );
                filePaths.add(absolutePath);
              }
            }
          }
        }

        content = content.slice(0, index);

        if (!Array.isArray(parsed)) {
          parsed.messages = content;
        } else {
          parsed = content;
        }
        await fs.promises.writeFile(
          logPath,
          JSON.stringify(parsed, null, 2),
          "utf-8",
        );

        await CheckpointManager.getInstance().revertToCheckpoint(
          conversationId,
          revertTimestamp,
        );

        // Clean up replace_in_file history using responseNumber-based deletion
        const historyManager = ReplaceInFileHistoryManager.getInstance();
        historyManager.setActiveConversationId(conversationId);

        if (filePaths.size === 0) {
        } else {
          // Delete versions for each file based on responseNumber
          for (const filePath of filePaths) {
            await historyManager.deleteVersionsFromResponseNumber(
              filePath,
              revertResponseNumber,
            );
          }
        }
      } finally {
        release();
      }

      webviewView.webview.postMessage({
        command: "conversationReverted",
        conversationId,
      });
    } catch (e: any) {
      console.error(
        "[REVERT-DEBUG] Error in handleRevertConversation:",
        e.message,
        e.stack,
      );
      webviewView.webview.postMessage({
        command: "conversationRevertedError",
        error: e.message,
      });
    }
  }
}
