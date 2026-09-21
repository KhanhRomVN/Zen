/**
 * ------------------------------------------------------------------
 * File Open Handler
 * ------------------------------------------------------------------
 * Mở file/folder trong editor hoặc OS file manager, hỗ trợ mở tại
 * dòng cụ thể.
 *
 * Main functions:
 * - handleOpenFile()  : Mở file trong editor. Nếu có message.line → jump tới dòng + selection
 * - handleOpenFolder() : Mở thư mục trong OS file manager
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ─── Class ──────────────────────────────────────────────────────────────
export class FileOpenHandler {
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
      const editor = await vscode.window.showTextDocument(document);

      const line = message.line;
      if (line !== undefined) {
        const selection = message.selection;
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
      }
    } catch (error) {
      console.error("[FileOpenHandler] handleOpenFile error:", error);
    }
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

  /**
   * Tạo thư mục (mkdir -p) nếu chưa tồn tại rồi mở trong OS file manager.
   * Dùng cho DatabaseManagerCard: user muốn tạo sẵn folder chứa file sqlite.
   */
  public async handleCreateFolderAndOpen(message: any) {
    const folderPath = message.path;
    if (!folderPath) return;

    try {
      const uri = vscode.Uri.file(folderPath);
      // Tạo folder nếu chưa tồn tại
      try {
        await vscode.workspace.fs.createDirectory(uri);
      } catch (_) {
        // Đã tồn tại hoặc permission error — bỏ qua, thử mở luôn
      }
      // Mở trong OS file manager
      try {
        await vscode.commands.executeCommand("revealFileInOS", uri);
      } catch {
        await vscode.env.openExternal(uri);
      }
    } catch (error) {
      console.error("[FileOpenHandler] handleCreateFolderAndOpen error:", error);
    }
  }

  /**
   * Mở dialog chọn file/folder của OS và trả kết quả về webview.
   * mode='pickFile' → chọn file; mode='pickFolder' → chọn thư mục.
   */
  public async handlePickPath(message: any, webviewView: vscode.WebviewView) {
    const mode = message.mode === "pickFolder" ? "pickFolder" : "pickFile";
    let path: string | undefined;
    let cancelled = true;

    try {
      const defaultPath =
        typeof message.defaultPath === "string" && message.defaultPath
          ? message.defaultPath
          : undefined;
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: mode === "pickFile",
        canSelectFolders: mode === "pickFolder",
        canSelectMany: false,
        defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined,
        openLabel: mode === "pickFile" ? "Select File" : "Select Folder",
      });
      if (uris && uris.length > 0) {
        path = uris[0].fsPath;
        cancelled = false;
      }
    } catch (error) {
      console.error("[FileOpenHandler] handlePickPath error:", error);
    }

    webviewView.webview.postMessage({
      command: "pathPicked",
      requestId: message.requestId,
      path,
      cancelled,
    });
  }
}
