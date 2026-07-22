import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { ContextManager } from "../../../context/ContextManager";
import { SecurityValidator } from "../../../agent/validators/SecurityValidator";
import { LoggerService } from "../../../services/LoggerService";
import { DiagnosticsService } from "../../../services/DiagnosticsService";

export class FileReadHandler {
  private _readFileQueue: Promise<void> = Promise.resolve();

  constructor(private contextManager: ContextManager) {}

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

  private resolveWorkspacePath(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): vscode.Uri {
    if (path.isAbsolute(pathValue)) return vscode.Uri.file(pathValue);
    return vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
  }

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

  private enqueueReadOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._readFileQueue = this._readFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueReadOperation] Error", { error: err.message });
        throw err;
      }) as Promise<void>;
    return this._readFileQueue as Promise<T>;
  }

  private getDiagnosticsForFile(uri: vscode.Uri) {
    return DiagnosticsService.getInstance().getDiagnostics(uri);
  }

  private isNonCodeFile(pathValue: string): boolean {
    return DiagnosticsService.getInstance().isNonCodeFile(pathValue);
  }

  private async ensureFileOpened(uri: vscode.Uri): Promise<void> {
    return DiagnosticsService.getInstance().ensureFileOpened(uri);
  }

  private async waitForDiagnosticsWithFallback(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 30000,
  ): Promise<void> {
    return DiagnosticsService.getInstance().waitForDiagnostics(
      uri,
      pathValue,
      maxTimeoutMs,
    );
  }

  public async handleReadFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      await this.enqueueReadOperation(async () => {
        await this._handleReadFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error("[handleReadFile] Failed", { error: e.message });
    }
  }

  private async _handleReadFileInternal(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      let absPath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absPath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
      } else {
        absPath = await this.resolveWorkspacePathWithFallback(
          workspaceFolder,
          pathValue,
        );
      }

      const securityCheck = SecurityValidator.validatePath(
        absPath.fsPath,
        false,
      );
      if (!securityCheck.safe)
        throw new Error(securityCheck.reason || "Security validation failed");

      if (
        !pathValue.endsWith("workspace.md") &&
        !fs.existsSync(absPath.fsPath)
      ) {
        throw new Error(`File not found: ${pathValue}`);
      }

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absPath.fsPath);
      if (
        ignoreCheck.ignored &&
        !pathValue.endsWith("workspace.md") &&
        !message.bypassIgnore
      ) {
        throw new Error(
          `Path '${pathValue}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }

      const logger = LoggerService.getInstance();
      const isNonCode = this.isNonCodeFile(pathValue);
      const shouldSkipDiagnostics = message.skipDiagnostics || isNonCode;

      if (!shouldSkipDiagnostics) {
        await this.ensureFileOpened(absPath);
        await this.waitForDiagnosticsWithFallback(absPath, pathValue, 50000); // 50 giây - phù hợp với 60s timeout frontend
      }

      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
      } catch (e: any) {
        if (!pathValue.endsWith("workspace.md")) throw e;
      }

      const startLine = message.start_line ?? message.startLine;
      const endLine = message.end_line ?? message.endLine;
      if (startLine !== undefined) {
        const lines = content.split(/\r?\n/);
        const end = endLine !== undefined ? endLine + 1 : lines.length;
        content = lines.slice(startLine || 0, end).join("\n");
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
}
