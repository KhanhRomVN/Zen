import * as vscode from "vscode";
import { ContextManager } from "../../context/ContextManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { RecentItemsManager } from "../../context/RecentItemsManager";
import { FileReadHandler } from "./file/FileReadHandler";
import { FileOperationHandler } from "./file/FileOperationHandler";
import { GitHandler } from "./file/GitHandler";
import { FileWriteHandler } from "./file/FileWriteHandler";

export class FileHandler {
  private readHandler: FileReadHandler;
  private writeHandler: FileWriteHandler;
  private operationHandler: FileOperationHandler;
  private gitHandler: GitHandler;

  constructor(
    private contextManager: ContextManager,
    private fileLockManager: FileLockManager,
    private recentItemsManager: RecentItemsManager | undefined,
  ) {
    this.readHandler = new FileReadHandler(contextManager);
    this.writeHandler = new FileWriteHandler(fileLockManager);
    this.operationHandler = new FileOperationHandler(
      contextManager,
      fileLockManager,
      recentItemsManager,
    );
    this.gitHandler = new GitHandler();
  }

  // ── Read ──
  public async handleReadFile(message: any, webviewView: vscode.WebviewView) {
    return this.readHandler.handleReadFile(message, webviewView);
  }

  // ── Write / Replace ──
  public async handleWriteFile(message: any, webviewView: vscode.WebviewView) {
    return this.writeHandler.handleWriteFile(message, webviewView);
  }
  public async handleReplaceInFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.writeHandler.handleReplaceInFile(message, webviewView);
  }

  // ── Operations ──
  public async handleListFiles(message: any, webviewView: vscode.WebviewView) {
    return this.operationHandler.handleListFiles(message, webviewView);
  }
  public async handleGetFileStats(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleGetFileStats(message, webviewView);
  }
  public async handleGetDiagnostics(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleGetDiagnostics(message, webviewView);
  }
  public async handleGetWorkspaceFiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleGetWorkspaceFiles(message, webviewView);
  }
  public async handleGetWorkspaceFolders(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleGetWorkspaceFolders(
      message,
      webviewView,
    );
  }
  public async handleGetWorkspaceTree(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleGetWorkspaceTree(message, webviewView);
  }
  public async handleFindFiles(message: any, webviewView: vscode.WebviewView) {
    return this.operationHandler.handleFindFiles(message, webviewView);
  }
  public async handleDeleteFile(message: any, webviewView: vscode.WebviewView) {
    return this.operationHandler.handleDeleteFile(message, webviewView);
  }
  public async handleDeleteFolder(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleDeleteFolder(message, webviewView);
  }
  public async handleMoveFile(message: any, webviewView: vscode.WebviewView) {
    return this.operationHandler.handleMoveFile(message, webviewView);
  }
  public async handleRevertFile(message: any, webviewView: vscode.WebviewView) {
    return this.operationHandler.handleRevertFile(message, webviewView);
  }
  public async handleViewReplaceHistory(message: any, webviewView: vscode.WebviewView) {
    return this.operationHandler.handleViewReplaceHistory(message, webviewView);
  }
  public async handleGetSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleGetSnapshot(message, webviewView);
  }
  public async handleAskBypassGitignore(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.operationHandler.handleAskBypassGitignore(message, webviewView);
  }
  public async handleValidateFuzzyMatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    // Legacy method — kept for backward compatibility, delegates to writeHandler pattern
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const absPath = vscode.Uri.joinPath(workspaceFolder.uri, message.path);
    const content = Buffer.from(
      await vscode.workspace.fs.readFile(absPath),
    ).toString("utf8");
    const match = message.diff.match(
      /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
    );
    if (!match) {
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "invalid_format",
      });
      return;
    }
    const clean = (text: string) =>
      text
        .replace(/^```[a-zA-Z]*$/gm, "")
        .trim()
        .replace(/\r\n/g, "\n");
    const search = clean(match[1]);
    const exact = content.replace(/\r\n/g, "\n").indexOf(search);
    if (exact !== -1) {
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "exact",
        searchBlock: search,
        foundBlock: search,
        score: 1.0,
        startLine: content.substring(0, exact).split(/\r?\n/).length,
      });
    } else {
      const { FuzzyMatcher } = require("../../utils/FuzzyMatcher");
      const fuzzy = FuzzyMatcher.findMatch(content, search);
      if (fuzzy) {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "fuzzy",
          score: fuzzy.score,
          searchBlock: search,
          foundBlock: fuzzy.originalText,
          startLine: fuzzy.startLine,
        });
      } else {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "none",
          searchBlock: search,
        });
      }
    }
  }

  // ── Git ──
  public async handleGetGitChanges(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.gitHandler.handleGetGitChanges(message, webviewView);
  }
  public async handleRunGitStatus(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    return this.gitHandler.handleRunGitStatus(message, webviewView);
  }
  public async handleGitDiff(message: any, webviewView: vscode.WebviewView) {
    return this.gitHandler.handleGitDiff(message, webviewView);
  }
}
