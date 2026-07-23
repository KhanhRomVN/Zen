/**
 *? Usage:
 *    Xử lý các lệnh hệ thống: theme, thông tin hệ thống, mở file/folder/diff, preview, confirmation dialog, git diff, accept commit message.
 *
 *? Function:
 *    updateTheme() / handleRequestTheme()      : Gửi theme hiện tại cho webview.
 *    handleGetSystemInfo()                     : Trả về thông tin OS, IDE, shell, home, cwd.
 *    handleOpenWorkspaceFolder()               : Mở thư mục workspace.
 *    handleOpenDiffView()                      : Mở diff view giữa file hiện tại và bản cũ.
 *    handleOpenFile() / handleOpenFileAtLine() : Mở file trong editor (có thể kèm dòng).
 *    handleOpenPreview() / handleOpenTempImage(): Mở nội dung tạm / ảnh base64.
 *    handleOpenExternal()                      : Mở URL ngoài.
 *    handleOpenFolder()                        : Mở thư mục trong OS file manager.
 *    handleConfirmation()                      : Hiển thị dialog xác nhận.
 *    handleOpenDiff()                          : Mở diff giữa 2 file.
 *    handleOpenReplaceInFileDiff()             : Mở diff cho thao tác replace_in_file.
 *    handleOpenWriteToFile()                   : Mở nội dung file mới sẽ được ghi.
 *    handleOpenSnapshotDiff()                  : Mở diff snapshot (create/rewrite/replace).
 *    handleShowGitDiff()                       : Mở git diff cho file.
 *    handleAcceptCommitMessage()               : Thực thi git commit với message được chấp nhận.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

// PROVIDERS
import { DiffProvider } from "../providers/DiffProvider";

// SERVICES
import { PathService } from "../services/PathService";

export class SystemHandler {
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
  }

  private getContextRoot(): string {
    return this.pathService.getContextRoot();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  private _getTempDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    const tmpDir = path.join(os.tmpdir(), "khanhromvn-zen", hash);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }

  public async handleRequestTheme(webviewView: vscode.WebviewView) {
    await this.updateTheme(webviewView.webview);
  }

  public async updateTheme(webview: vscode.Webview) {
    const theme = vscode.window.activeColorTheme;
    const themeKind = theme.kind;
    const colorTheme =
      vscode.workspace
        .getConfiguration("workbench")
        .get<string>("colorTheme") || "Default Dark Modern";

    webview.postMessage({
      command: "updateTheme",
      theme: themeKind,
      themeId: colorTheme,
      themeVersion: Date.now(),
    });
  }

  public handleGetSystemInfo(message: any, webviewView: vscode.WebviewView) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const platform = process.platform;
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
    const shell = process.env.SHELL || "/bin/bash";
    let osName = "Unknown";
    if (platform === "linux") osName = "Linux";
    else if (platform === "darwin") osName = "macOS";
    else if (platform === "win32") osName = "Windows";

    webviewView.webview.postMessage({
      command: "systemInfo",
      requestId: message.requestId,
      data: {
        os: osName,
        ide: "Visual Studio Code",
        shell: shell,
        homeDir: homeDir,
        cwd: workspaceFolder?.uri.fsPath || homeDir,
      },
    });
  }

  public async handleOpenWorkspaceFolder(message: any) {
    const folderPath = message.path;
    if (!folderPath) return;

    try {
      const findFirstFile = async (
        dir: string,
      ): Promise<vscode.Uri | undefined> => {
        const entries = await vscode.workspace.fs.readDirectory(
          vscode.Uri.file(dir),
        );

        entries.sort((a, b) => {
          if (a[1] !== b[1]) {
            return a[1] === vscode.FileType.File ? -1 : 1;
          }
          return a[0].localeCompare(b[0]);
        });

        for (const [name, type] of entries) {
          const entryPath = path.join(dir, name);
          if (type === vscode.FileType.File) {
            return vscode.Uri.file(entryPath);
          } else if (type === vscode.FileType.Directory) {
            const result = await findFirstFile(entryPath);
            if (result) return result;
          }
        }
        return undefined;
      };

      const firstFileUri = await findFirstFile(folderPath);
      if (firstFileUri) {
        const document = await vscode.workspace.openTextDocument(firstFileUri);
        await vscode.window.showTextDocument(document);
      } else {
        vscode.window.showInformationMessage("No files found in this folder.");
      }
    } catch (error) {}
  }

  public async handleOpenDiffView(message: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const actualPath = path.isAbsolute(message.filePath)
      ? vscode.Uri.file(message.filePath)
      : vscode.Uri.joinPath(workspaceFolder.uri, message.filePath);
    const tmpDir = this._getTempDir(workspaceFolder.uri.fsPath);
    const basename = path.basename(message.filePath);
    const tempFile = vscode.Uri.file(path.join(tmpDir, basename));
    await vscode.workspace.fs.writeFile(
      tempFile,
      Buffer.from(message.newCode, "utf8"),
    );
    await vscode.commands.executeCommand(
      "vscode.diff",
      actualPath,
      tempFile,
      `${basename} (Current ↔ Previous)`,
    );
  }

  public async handleOpenFile(message: any) {
    const filePath = message.path;

    if (!filePath) {
      return;
    }

    try {
      const uri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            filePath,
          );
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      console.error("[SystemHandler] handleOpenFile error:", error);
    }
  }

  public async handleOpenFileAtLine(message: any) {
    const filePath = message.path;
    const line = message.line || 1;
    const selection = message.selection;

    if (!filePath) return;

    try {
      const uri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            filePath,
          );
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      const lineIndex = Math.max(0, line - 1);
      const lineText = document.lineAt(lineIndex);
      const position = new vscode.Position(lineIndex, 0);

      if (selection && selection.startLine && selection.endLine) {
        const startPos = new vscode.Position(
          Math.max(0, selection.startLine - 1),
          0,
        );
        const endPos = new vscode.Position(
          Math.min(document.lineCount - 1, selection.endLine - 1),
          document.lineAt(
            Math.min(document.lineCount - 1, selection.endLine - 1),
          ).text.length,
        );
        editor.selection = new vscode.Selection(startPos, endPos);
        editor.revealRange(
          new vscode.Range(startPos, endPos),
          vscode.TextEditorRevealType.InCenter,
        );
      } else {
        const endPosition = new vscode.Position(
          lineIndex,
          lineText.text.length,
        );
        editor.selection = new vscode.Selection(position, endPosition);
        editor.revealRange(
          new vscode.Range(position, endPosition),
          vscode.TextEditorRevealType.InCenter,
        );
      }
    } catch (error) {
      console.error("[SystemHandler] handleOpenFileAtLine error:", error);
    }
  }

  public async handleOpenPreview(message: any) {
    const doc = await vscode.workspace.openTextDocument({
      content: message.content,
      language: message.language || "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  public async handleOpenTempImage(message: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const tmpDir = this._getTempDir(workspaceFolder.uri.fsPath);
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const base64 = message.content.replace(/^data:image\/\w+;base64,/, "");
    const tmpFile = vscode.Uri.file(
      path.join(tmpDir, `temp-${Date.now()}.png`),
    );
    await vscode.workspace.fs.writeFile(tmpFile, Buffer.from(base64, "base64"));
    await vscode.commands.executeCommand("vscode.open", tmpFile);
  }

  public handleOpenExternal(message: any) {
    if (message.url) vscode.env.openExternal(vscode.Uri.parse(message.url));
  }

  public async handleOpenFolder(message: any) {
    const folderPath = message.path;
    if (!folderPath) return;

    try {
      await vscode.commands.executeCommand(
        "revealFileInOS",
        vscode.Uri.file(folderPath),
      );
    } catch (error) {
      try {
        await vscode.env.openExternal(vscode.Uri.file(folderPath));
      } catch (e) {}
    }
  }

  public async handleConfirmation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const rawAction = message.command.replace("confirm", "");
    const action = rawAction.charAt(0).toLowerCase() + rawAction.slice(1);
    const result = await vscode.window.showWarningMessage(
      message.text || `Are you sure you want to ${action}?`,
      { modal: true },
      "Yes",
    );
    if (result === "Yes") {
      webviewView.webview.postMessage({
        command: `${action}Confirmed`,
        requestId: message.requestId,
        conversationId: message.conversationId,
        confirmed: true,
      });
    }
  }

  public async handleOpenDiff(message: any) {
    await vscode.commands.executeCommand(
      "vscode.diff",
      vscode.Uri.file(message.leftPath),
      vscode.Uri.file(message.rightPath),
      message.title || "Diff",
    );
  }

  public async handleOpenReplaceInFileDiff(message: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const filePath = message.filePath;
    const basename = path.basename(filePath || "file");

    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceFolder.uri.fsPath, filePath);

    try {
      const oldStr = message.oldContent || "";
      const newStr = message.newContent || "";

      let beforeContent: string;
      let afterContent: string;

      let currentContent: string | null = null;
      try {
        currentContent = await fs.promises.readFile(absPath, "utf8");
      } catch (readError: any) {
        if (readError.code === "ENOENT") {
        } else {
          throw readError;
        }
      }

      if (currentContent) {
        if (oldStr && currentContent.includes(oldStr)) {
          beforeContent = currentContent;
          const index = currentContent.indexOf(oldStr);
          afterContent =
            currentContent.substring(0, index) +
            newStr +
            currentContent.substring(index + oldStr.length);
        } else if (newStr && currentContent.includes(newStr)) {
          afterContent = currentContent;
          const index = currentContent.indexOf(newStr);
          beforeContent =
            currentContent.substring(0, index) +
            oldStr +
            currentContent.substring(index + newStr.length);
        } else {
          console.error(
            `[handleOpenReplaceInFileDiff] Cannot find old_str or new_str in file`,
            {
              filePath,
              oldStrPreview: oldStr.substring(0, 100),
              newStrPreview: newStr.substring(0, 100),
              currentContentPreview: currentContent.substring(0, 200),
            },
          );
          vscode.window.showErrorMessage(
            `Cannot create diff: neither old nor new content found in file`,
          );
          return;
        }
      } else {
        beforeContent = oldStr;
        afterContent = newStr;
      }

      if (beforeContent === afterContent) {
        vscode.window.showWarningMessage(
          `Diff view: before and after content are identical`,
        );
      }

      const ext = path.extname(basename);
      const nameWithoutExt = path.basename(basename, ext);
      const tempBasename = `${nameWithoutExt}_TEMP${ext}`;

      const stableId = `replace_${Buffer.from(filePath).toString("base64").replace(/[/+=]/g, "_").toLowerCase()}`;
      const beforeKey = `${stableId}_before`;
      const afterKey = `${stableId}_after`;

      DiffProvider.instance.store(beforeKey, beforeContent);
      DiffProvider.instance.store(afterKey, afterContent);

      const beforeUri = DiffProvider.toUri(beforeKey, tempBasename);
      const afterUri = DiffProvider.toUri(afterKey, tempBasename);

      const diffTitle = `${tempBasename} (Before ↔ After)`;

      await vscode.commands.executeCommand(
        "vscode.diff",
        beforeUri,
        afterUri,
        diffTitle,
      );
    } catch (error) {
      console.error(
        "[SystemHandler] handleOpenReplaceInFileDiff error:",
        error,
      );
      vscode.window.showErrorMessage(`Failed to open diff: ${error}`);
    }
  }

  public async handleOpenWriteToFile(message: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const filePath = message.filePath;
    const basename = path.basename(filePath || "file");
    const content = message.content || "";

    try {
      const ext = path.extname(basename);
      const nameWithoutExt = path.basename(basename, ext);
      const tempBasename = `${nameWithoutExt}_TEMP${ext}`;

      const stableId = `write_${Buffer.from(filePath).toString("base64").replace(/[/+=]/g, "_").toLowerCase()}`;

      DiffProvider.instance.store(stableId, content);

      const uri = DiffProvider.toUri(stableId, tempBasename);

      for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
          const input = tab.input as any;
          if (input?.uri?.toString() === uri.toString()) {
            await vscode.window.showTextDocument(uri, {
              preview: false,
              preserveFocus: false,
            });
            return;
          }
        }
      }

      await vscode.window.showTextDocument(uri, {
        preview: false,
        preserveFocus: false,
      });
    } catch (error) {
      console.error("[SystemHandler] handleOpenWriteToFile error:", error);
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  public async handleOpenSnapshotDiff(message: any) {
    const { filePath, operation, beforeContent, afterContent, actionId } =
      message;
    const basename = path.basename(filePath || "file");

    if (operation === "write" && beforeContent === null) {
      try {
        const uri = path.isAbsolute(filePath)
          ? vscode.Uri.file(filePath)
          : vscode.Uri.joinPath(
              vscode.workspace.workspaceFolders![0].uri,
              filePath,
            );
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        const doc = await vscode.workspace.openTextDocument({
          content: afterContent || "",
          language: this._getLanguageId(filePath),
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      }
      return;
    }

    const safeId = (actionId || Date.now())
      .toString()
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const beforeKey = `${safeId}_before`;
    const afterKey = `${safeId}_after`;

    DiffProvider.instance.store(beforeKey, beforeContent || "");
    DiffProvider.instance.store(afterKey, afterContent || "");

    const beforeUri = DiffProvider.toUri(beforeKey, basename);
    const afterUri = DiffProvider.toUri(afterKey, basename);

    const label =
      operation === "write"
        ? `${basename} (Before ↔ After Rewrite)`
        : `${basename} (Before ↔ After Edit)`;

    await vscode.commands.executeCommand(
      "vscode.diff",
      beforeUri,
      afterUri,
      label,
    );
  }

  private _getLanguageId(filePath: string): string {
    const ext = (filePath || "").split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
      ts: "typescript",
      tsx: "typescriptreact",
      js: "javascript",
      jsx: "javascriptreact",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      css: "css",
      scss: "scss",
      html: "html",
      json: "json",
      md: "markdown",
      sh: "shellscript",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      sql: "sql",
      php: "php",
      rb: "ruby",
      kt: "kotlin",
      swift: "swift",
      dart: "dart",
      c: "c",
      cpp: "cpp",
    };
    return map[ext] || "plaintext";
  }

  public async handleShowGitDiff(message: any) {
    // [DEBUG] Đo thời gian mở git diff — xóa sau khi xác minh
    const debugStart = Date.now();
    const filePath = message.filePath;
    if (!filePath) {
      console.error("[SystemHandler] showGitDiff: No filePath provided");
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.error("[SystemHandler] No workspace folder found");
        vscode.window.showErrorMessage("Không tìm thấy workspace folder");
        return;
      }

      const uri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(workspaceFolder.uri, filePath);

      try {
        const document = await vscode.workspace.openTextDocument(uri);
      } catch (error) {}

      try {
        await vscode.commands.executeCommand("git.openChange", uri, "HEAD");
        return;
      } catch (error) {}

      try {
        await vscode.commands.executeCommand("git.openResource", uri, "HEAD");
        return;
      } catch (error) {}

      try {
        await vscode.commands.executeCommand("git.openResource", uri);
        return;
      } catch (error) {}

      try {
        await vscode.commands.executeCommand("git.show", uri);
        return;
      } catch (error) {}

      try {
        await vscode.commands.executeCommand("git.openFile", uri);
        return;
      } catch (error) {}

      try {
        await vscode.commands.executeCommand("git.openFile2", uri);
        return;
      } catch (error) {}

      try {
        await vscode.commands.executeCommand("git.stage", uri);
        return;
      } catch (error) {}

      try {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage(
          `Đã mở file ${path.basename(filePath)}. Sử dụng Source Control để xem diff.`,
        );
      } catch (error) {
        console.error("[SystemHandler] Failed to open file:", error);
        vscode.window.showErrorMessage(
          `Không thể mở file: ${path.basename(filePath)}`,
        );
      }
    } catch (error) {
      console.error("[SystemHandler] showGitDiff error:", error);
      vscode.window.showErrorMessage(`Lỗi khi mở git diff: ${error}`);
    }
  }

  public async handleAcceptCommitMessage(
    message: any,
    webviewView?: vscode.WebviewView,
  ) {
    const commitMessage = message.message;
    if (!commitMessage) {
      console.error("[SystemHandler] acceptCommitMessage: No message provided");
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.error("[SystemHandler] No workspace folder found");
        return;
      }

      const cwd = workspaceFolder.uri.fsPath;
      const { exec } = require("child_process");

      const escapedMessage = commitMessage.replace(/'/g, "'\\''");

      const commitResult = await new Promise<{
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        exec(
          `git commit -m '${escapedMessage}'`,
          { cwd },
          (err: any, stdout: string, stderr: string) => {
            if (err && !stderr.includes("nothing to commit")) {
              reject(new Error(stderr || err.message));
            } else {
              resolve({ stdout, stderr });
            }
          },
        );
      });

      if (commitResult.stderr.includes("nothing to commit")) {
        return;
      }

      await vscode.env.clipboard.writeText(commitMessage);
    } catch (error) {
      console.error("[SystemHandler] acceptCommitMessage error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (webviewView?.webview) {
        webviewView.webview.postMessage({
          command: "commitError",
          error: errorMsg,
          timestamp: Date.now(),
        });
      } else {
        try {
          const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
          if (activeTab && "webview" in activeTab) {
            const webview = (activeTab as any).webview;
            if (webview) {
              webview.postMessage({
                command: "commitError",
                error: errorMsg,
                timestamp: Date.now(),
              });
            }
          }
        } catch (e) {}
      }
    }
  }
}
