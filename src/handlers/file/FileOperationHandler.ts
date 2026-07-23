import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { CheckpointManager } from "../../managers/CheckpointManager";
import { SnapshotManager } from "../../managers/SnapshotManager";
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";
import { SecurityValidator } from "../../agent/validators/SecurityValidator";
import { LoggerService } from "../../services/LoggerService";

export class FileOperationHandler {
  private async resolveWorkspacePathWithFallback(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): Promise<vscode.Uri> {
    const candidates = path.isAbsolute(pathValue)
      ? [
          vscode.Uri.file(pathValue),
          vscode.Uri.joinPath(workspaceFolder.uri, pathValue),
        ]
      : [
          vscode.Uri.joinPath(workspaceFolder.uri, pathValue),
          vscode.Uri.file(pathValue),
        ];
    let lastError: unknown;
    for (const uri of candidates) {
      try {
        await vscode.workspace.fs.stat(uri);
        return uri;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  private getDiagnosticsForFile(uri: vscode.Uri): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
    return vscode.languages
      .getDiagnostics(uri)
      .filter(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map((d) => ({
        severity:
          d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning",
        message: d.message,
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        source: d.source,
        code: d.code
          ? typeof d.code === "object"
            ? d.code.value
            : d.code
          : undefined,
      }));
  }

  private getDiagnosticCountForFile(uri: vscode.Uri): {
    errorCount: number;
    warningCount: number;
  } {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return {
      errorCount: diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error,
      ).length,
      warningCount: diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Warning,
      ).length,
    };
  }

  // ── Get File Stats ──
  public async handleGetFileStats(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const uri = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        message.path,
      );
      const stat = await vscode.workspace.fs.stat(uri);
      const content = await vscode.workspace.fs.readFile(uri);
      const lines = Buffer.from(content).toString("utf8").split("\n").length;
      webviewView.webview.postMessage({
        command: "fileStatsResult",
        requestId: message.requestId,
        id: message.id,
        path: message.path,
        lines,
        stats: {
          size: stat.size,
          mtime: stat.mtime,
          type: stat.type === vscode.FileType.Directory ? "directory" : "file",
        },
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "fileStatsResult",
        requestId: message.requestId,
        id: message.id,
        path: message.path,
        error: e.message,
      });
    }
  }

  // ── Get Diagnostics ──
  public async handleGetDiagnostics(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "getDiagnosticsResult",
          requestId: message.requestId,
          path: message.path,
          diagnostics: [],
        });
        return;
      }
      const uri = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        message.path,
      );
      webviewView.webview.postMessage({
        command: "getDiagnosticsResult",
        requestId: message.requestId,
        path: message.path,
        diagnostics: this.getDiagnosticsForFile(uri),
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "getDiagnosticsResult",
        requestId: message.requestId,
        path: message.path,
        diagnostics: [],
        error: e.message,
      });
    }
  }

  // ── Find Files ──
  public async handleFindFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder found");
      const fileNames: string[] = message.fileNames || message.file_names || [];
      if (!fileNames || fileNames.length === 0)
        throw new Error("No file names provided");
      const results: {
        fileName: string;
        matches: Array<{
          path: string;
          errorCount?: number;
          warningCount?: number;
        }>;
      }[] = [];
      for (const fileName of fileNames) {
        const globPattern = `**/${fileName}`;
        try {
          const files = await vscode.workspace.findFiles(
            globPattern,
            "**/node_modules/**",
          );
          const matches = files.map((fileUri) => {
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const dc = this.getDiagnosticCountForFile(fileUri);
            return {
              path: relativePath,
              errorCount: dc.errorCount,
              warningCount: dc.warningCount,
            };
          });
          results.push({ fileName, matches });
        } catch (error: any) {
          results.push({ fileName, matches: [] });
        }
      }
      webviewView.webview.postMessage({
        command: "findFilesResult",
        requestId: message.requestId,
        results,
        totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "findFilesResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleListFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "listFilesResult",
          requestId: message.requestId,
          path: message.path || message.folder_path,
          error: "No workspace folder found",
        });
        return;
      }

      const pathValue = message.path || message.folder_path || message.filePath;
      const dirPath = pathValue || ".";
      const absolutePath = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        dirPath,
      ).catch(() => {
        if (path.isAbsolute(dirPath)) return vscode.Uri.file(dirPath);
        return vscode.Uri.joinPath(workspaceFolder.uri, dirPath);
      });

      let maxDepth = 1;
      if (message.depth !== undefined && message.depth !== null) {
        if (String(message.depth).toLowerCase() === "max") maxDepth = 999;
        else maxDepth = parseInt(String(message.depth), 10) || 1;
      } else if (message.recursive === "true" || message.recursive === true) {
        maxDepth = 20;
      } else if (message.recursive) {
        maxDepth = parseInt(String(message.recursive), 10) || 1;
      }

      const buildTree = async (
        dirUri: vscode.Uri,
        currentDepth: number,
      ): Promise<any[]> => {
        if (currentDepth > maxDepth) return [];

        let entries: [string, vscode.FileType][];
        try {
          entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch {
          return [];
        }

        // Sắp xếp: folder trước, file sau; alphabet trong mỗi nhóm
        entries.sort((a, b) => {
          const aIsDir = a[1] === vscode.FileType.Directory ? 0 : 1;
          const bIsDir = b[1] === vscode.FileType.Directory ? 0 : 1;
          if (aIsDir !== bIsDir) return aIsDir - bIsDir;
          return a[0].localeCompare(b[0]);
        });

        const results: any[] = [];
        for (const [name, fileType] of entries) {
          // Bỏ qua node_modules và thư mục ẩn
          if (name === "node_modules" || name.startsWith(".")) continue;

          const entryUri = vscode.Uri.joinPath(dirUri, name);
          if (fileType === vscode.FileType.Directory) {
            const children = await buildTree(entryUri, currentDepth + 1);
            results.push({
              name,
              type: "folder",
              children,
            });
          } else {
            let lines: number | undefined;
            try {
              const content = await vscode.workspace.fs.readFile(entryUri);
              lines = Buffer.from(content).toString("utf8").split("\n").length;
            } catch {
              lines = undefined;
            }
            results.push({
              name,
              type: "file",
              lines,
            });
          }
        }
        return results;
      };

      const tree = await buildTree(absolutePath, 1);

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

  // ── Delete File/Folder ──
  public async handleDeleteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path;
      if (!filePath) throw new Error("'file_path' is required");
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);
      await CheckpointManager.getInstance().createCheckpoint(absPath, "delete");
      await fs.promises.unlink(absPath);
      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        success: true,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  // ── Move File ──
  public async handleMoveFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const sourcePath = message.file_path || message.source_path;
      const targetFolderPath = message.target_folder_path;
      if (!sourcePath) throw new Error("'file_path' is required");
      if (!targetFolderPath)
        throw new Error("'target_folder_path' is required");

      const absSource = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(workspaceFolder.uri.fsPath, sourcePath);
      const absTargetFolder = path.isAbsolute(targetFolderPath)
        ? targetFolderPath
        : path.join(workspaceFolder.uri.fsPath, targetFolderPath);

      const sc = SecurityValidator.validatePath(absSource, false);
      if (!sc.safe)
        throw new Error(sc.reason || "Security validation failed for source");
      const tc = SecurityValidator.validatePath(absTargetFolder, true);
      if (!tc.safe)
        throw new Error(tc.reason || "Security validation failed for target");

      try {
        await fs.promises.stat(absSource);
      } catch {
        throw new Error(`Source file not found: '${sourcePath}'`);
      }
      await fs.promises.mkdir(absTargetFolder, { recursive: true });
      const fileName = path.basename(absSource);
      const absDest = path.join(absTargetFolder, fileName);

      const cpm = CheckpointManager.getInstance();
      if (message.conversationId)
        cpm.setActiveConversationId(message.conversationId);
      await cpm.createCheckpoint(absSource, "delete");

      try {
        await fs.promises.rename(absSource, absDest);
      } catch (renameErr: any) {
        if (renameErr.code === "EXDEV") {
          await fs.promises.copyFile(absSource, absDest);
          await fs.promises.unlink(absSource);
        } else throw renameErr;
      }
      const newPath = path
        .relative(workspaceFolder.uri.fsPath, absDest)
        .replace(/\\/g, "/");
      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        success: true,
        newPath,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  // revert_file
  public async handleRevertFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path || message.path;
      const version = message.version; // Thêm hỗ trợ version parameter

      if (!filePath) throw new Error("'file_path' is required");
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);
      const pc = SecurityValidator.validatePath(absPath, false);
      if (!pc.safe) throw new Error(pc.reason || "Security validation failed");
      try {
        await fs.promises.stat(absPath);
      } catch {
        throw new Error(`File not found: '${filePath}'`);
      }

      const beforeContent = await fs.promises.readFile(absPath, "utf-8");

      let afterContent: string;

      // Nếu có version, sử dụng replace history thay vì checkpoint
      if (version !== undefined && version !== null && message.conversationId) {
        const historyManager = ReplaceInFileHistoryManager.getInstance();
        historyManager.setActiveConversationId(message.conversationId);

        const history = await historyManager.getHistoryVersion(
          absPath,
          parseInt(version, 10),
        );
        if (!history) {
          throw new Error(
            `No history found for version ${version} of file '${filePath}'`,
          );
        }

        afterContent = history.fullContent;

        // Ghi nội dung từ history vào file
        await fs.promises.writeFile(absPath, afterContent, "utf-8");

        // Xóa các version sau version được chọn
        await historyManager.deleteVersionsAfter(
          absPath,
          parseInt(version, 10),
        );
      } else {
        // Sử dụng checkpoint cũ (revert 1 lần)
        const cpm = CheckpointManager.getInstance();
        const checkpoint = await cpm.getLastCheckpointForFile(absPath);

        if (!checkpoint) {
          throw new Error(
            `No checkpoint found for file '${filePath}'. Cannot revert.`,
          );
        }

        if (checkpoint.content === null) {
          throw new Error(
            `Checkpoint for '${filePath}' has no content. Cannot revert.`,
          );
        }

        afterContent = checkpoint.content;
        await fs.promises.writeFile(absPath, afterContent, "utf-8");
      }

      const fileUri = vscode.Uri.file(absPath);

      // Check if revert actually changed content
      if (beforeContent === afterContent) {
        logger.warn(
          `[DEBUG revert_file] WARNING: Content unchanged after revert!`,
        );
      }

      // Đợi language server cập nhật diagnostics (500ms)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Lấy diagnostics sau khi revert
      const diagnostics = this.getDiagnosticsForFile(fileUri);

      if (message.conversationId && message.actionId) {
        await SnapshotManager.getInstance().saveSnapshot(
          message.conversationId,
          message.actionId,
          absPath,
          "revert",
          beforeContent,
          afterContent,
        );
      }
      webviewView.webview.postMessage({
        command: "revertFileResult",
        requestId: message.requestId,
        success: true,
        path: filePath,
        oldContent: beforeContent,
        newContent: afterContent,
        diagnostics,
      });
    } catch (e: any) {
      logger.error(`[DEBUG revert_file] Error: ${e.message}`);
      webviewView.webview.postMessage({
        command: "revertFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  // ── Get Snapshot ──
  public async handleGetSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    try {
      const { conversationId, actionId, requestId } = message;
      if (!conversationId || !actionId)
        throw new Error("conversationId and actionId are required");
      const snapshot = await SnapshotManager.getInstance().getSnapshot(
        conversationId,
        actionId,
      );
      if (!snapshot) {
        webviewView.webview.postMessage({
          command: "getSnapshotResult",
          requestId,
          error: "Snapshot not found",
        });
        return;
      }
      webviewView.webview.postMessage({
        command: "getSnapshotResult",
        requestId,
        actionId,
        filePath: snapshot.filePath,
        operation: snapshot.operation,
        beforeContent: snapshot.beforeContent,
        afterContent: snapshot.afterContent,
        timestamp: snapshot.timestamp,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "getSnapshotResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  // ── View Replace History ──
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
