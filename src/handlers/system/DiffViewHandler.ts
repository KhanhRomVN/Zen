/**
 *? Usage:
 *    Mở diff view: replace_in_file diff và git diff.
 *
 *? Function:
 *    handleFileDiff()    : Mở diff cho thao tác file (replace, revert...).
 *    handleShowGitDiff() : Mở git diff cho file.
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// PROVIDERS
import { DiffProvider } from "../../providers/DiffProvider";

// SERVICES
import { PathService } from "../../services/PathService";

export class DiffViewHandler {
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
  }

  public async handleFileDiff(message: any) {
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
            `[DiffViewHandler] Cannot find old_str or new_str in file`,
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
        "[DiffViewHandler] handleFileDiff error:",
        error,
      );
      vscode.window.showErrorMessage(`Failed to open diff: ${error}`);
    }
  }

  public async handleShowGitDiff(message: any) {
    // [DEBUG] Đo thời gian mở git diff — xóa sau khi xác minh
    const debugStart = Date.now();
    const filePath = message.filePath;
    if (!filePath) {
      console.error("[DiffViewHandler] showGitDiff: No filePath provided");
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.error("[DiffViewHandler] No workspace folder found");
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
        console.error("[DiffViewHandler] Failed to open file:", error);
        vscode.window.showErrorMessage(
          `Không thể mở file: ${path.basename(filePath)}`,
        );
      }
    } catch (error) {
      console.error("[DiffViewHandler] showGitDiff error:", error);
      vscode.window.showErrorMessage(`Lỗi khi mở git diff: ${error}`);
    }
  }
}