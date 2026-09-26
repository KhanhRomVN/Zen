/**
 * ------------------------------------------------------------------
 * Revert Conversation Handler
 * ------------------------------------------------------------------
 * Khôi phục hội thoại về trước một message, kèm checkpoint để có
 * thể undo.
 *
 * Main functions:
 * - handleRevertConversation() : Khôi phục hội thoại về trước một message,
 *                                kèm checkpoint
 * - parseActionsFromContent()  : Parse tool actions từ nội dung message
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ── Managers ──
import { CheckpointManager } from "../../managers/CheckpointManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";

// ── Services ──
import { PathService } from "../../services/PathService";

// ── Utils ──
import { migrateConversationIfNeeded } from "../../utils/conversationMigration";

// ─── Functions ──────────────────────────────────────────────────────────
/**
 * Parse actions from message content (markdown format)
 * Extracts tool actions like [replace_in_file for 'file.txt'] or [write_to_file for 'file.txt']
 */
function parseActionsFromContent(content: string): Array<{
  type: string;
  filePath?: string;
  actionId?: string;
  additions?: number;
  deletions?: number;
}> {
  const actions: Array<{
    type: string;
    filePath?: string;
    actionId?: string;
    additions?: number;
    deletions?: number;
  }> = [];

  // File-modifying tools to track
  const FILE_TOOLS = [
    "replace_in_file",
    "write_to_file",
    "create_file",
    "delete_file",
    "rename_file",
    "move_file",
  ];

  // Pattern 1: tool result format — [tool_name for 'file_path'] Result: ...
  const toolResultPattern = /\[(\w+)\s+for\s+'([^']+)'\]/g;
  let match;
  while ((match = toolResultPattern.exec(content)) !== null) {
    const toolName = match[1];
    const filePath = match[2];
    if (FILE_TOOLS.includes(toolName)) {
      actions.push({ type: toolName, filePath });
    }
  }

  // Pattern 2: XML tag format in assistant messages — parse with stats
  // write_to_file / create_file: count lines in <content>
  const writePattern =
    /<(write_to_file|create_file)>\s*<file_path>([^<]+)<\/file_path>\s*<content>([\s\S]*?)<\/content>/g;
  while ((match = writePattern.exec(content)) !== null) {
    const toolName = match[1];
    const filePath = match[2].trim();
    const fileContent = match[3];
    const lineCount = fileContent.split("\n").length;
    const alreadyCaptured = actions.some(
      (a) => a.filePath === filePath && a.type === toolName,
    );
    if (!alreadyCaptured) {
      actions.push({
        type: toolName,
        filePath,
        additions: lineCount,
        deletions: 0,
      });
    } else {
      // Enrich existing entry with stats
      const existing = actions.find(
        (a) => a.filePath === filePath && a.type === toolName,
      );
      if (existing) {
        existing.additions = lineCount;
        existing.deletions = 0;
      }
    }
  }

  // replace_in_file: count lines in <old_str> (deletions) and <new_str> (additions)
  const replacePattern =
    /<replace_in_file>\s*<file_path>([^<]+)<\/file_path>\s*<old_str>([\s\S]*?)<\/old_str>\s*<new_str>([\s\S]*?)<\/new_str>/g;
  while ((match = replacePattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const oldStr = match[2];
    const newStr = match[3];
    const deletions = oldStr.split("\n").length;
    const additions = newStr.split("\n").length;
    const alreadyCaptured = actions.some(
      (a) => a.filePath === filePath && a.type === "replace_in_file",
    );
    if (!alreadyCaptured) {
      actions.push({ type: "replace_in_file", filePath, additions, deletions });
    } else {
      const existing = actions.find(
        (a) => a.filePath === filePath && a.type === "replace_in_file",
      );
      if (existing) {
        existing.additions = additions;
        existing.deletions = deletions;
      }
    }
  }

  // delete_file
  const deletePattern = /<delete_file>\s*<file_path>([^<]+)<\/file_path>/g;
  while ((match = deletePattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const alreadyCaptured = actions.some(
      (a) => a.filePath === filePath && a.type === "delete_file",
    );
    if (!alreadyCaptured) {
      actions.push({ type: "delete_file", filePath });
    }
  }

  return actions;
}

// ─── Class ──────────────────────────────────────────────────────────────
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

      const logPath = await migrateConversationIfNeeded(
        workspaceFolder.uri.fsPath,
        conversationId,
      );

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

        // FIX P3: Remove empty block — only delete versions if there are files to process
        if (filePaths.size > 0) {
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

  /**
   * Preview which files would be affected by reverting to a given message.
   * Returns a list of file paths without actually performing the revert.
   */
  public async handleGetRevertPreview(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "revertPreviewResult",
          messageId: message.messageId,
          files: [],
        });
        return;
      }

      const { conversationId, messageId } = message;
      if (!conversationId || !messageId) {
        webviewView.webview.postMessage({
          command: "revertPreviewResult",
          messageId,
          files: [],
        });
        return;
      }

      const logPath = await migrateConversationIfNeeded(
        workspaceFolder.uri.fsPath,
        conversationId,
      );

      if (!fs.existsSync(logPath)) {
        webviewView.webview.postMessage({
          command: "revertPreviewResult",
          messageId,
          files: [],
        });
        return;
      }

      const fileData = await fs.promises.readFile(logPath, "utf-8");
      let parsed: any;
      try {
        parsed = JSON.parse(fileData);
      } catch {
        webviewView.webview.postMessage({
          command: "revertPreviewResult",
          messageId,
          files: [],
        });
        return;
      }

      let content: any[];
      if (Array.isArray(parsed)) {
        content = parsed;
      } else if (parsed && Array.isArray(parsed.messages)) {
        content = parsed.messages;
      } else {
        webviewView.webview.postMessage({
          command: "revertPreviewResult",
          messageId,
          files: [],
        });
        return;
      }

      const index = content.findIndex((m: any) => m.id === messageId);
      if (index === -1) {
        webviewView.webview.postMessage({
          command: "revertPreviewResult",
          messageId,
          files: [],
        });
        return;
      }

      const messagesToDelete = content.slice(index);
      // Map filePath → { type, additions, deletions } — last write wins per file
      const fileMap = new Map<
        string,
        { type: string; additions: number; deletions: number }
      >();
      for (const msg of messagesToDelete) {
        const isToolMessage = msg.role === "user" && msg.id.includes("-tool");
        const isAssistantMessage = msg.role === "assistant";

        if ((isToolMessage || isAssistantMessage) && msg.content) {
          const parsedActions = parseActionsFromContent(msg.content);
          for (const action of parsedActions) {
            if (action.filePath) {
              const absolutePath = this.resolveToAbsolute(
                workspaceFolder,
                action.filePath,
              );
              const relativePath = path.relative(
                workspaceFolder.uri.fsPath,
                absolutePath,
              );
              const existing = fileMap.get(relativePath);
              if (!existing) {
                fileMap.set(relativePath, {
                  type: action.type,
                  additions: action.additions ?? 0,
                  deletions: action.deletions ?? 0,
                });
              } else {
                // Accumulate stats for multiple edits on same file
                existing.additions += action.additions ?? 0;
                existing.deletions += action.deletions ?? 0;
              }
            }
          }
        }
      }

      const files = Array.from(fileMap.entries()).map(([filePath, stats]) => ({
        filePath,
        actionType: stats.type,
        additions: stats.additions,
        deletions: stats.deletions,
      }));

      webviewView.webview.postMessage({
        command: "revertPreviewResult",
        messageId,
        files,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "revertPreviewResult",
        messageId: message.messageId,
        files: [],
      });
    }
  }
}
