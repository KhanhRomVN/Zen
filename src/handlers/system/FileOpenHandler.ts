/**
 *? Usage:
 *    Mở file/folder trong editor hoặc OS file manager, hỗ trợ mở tại dòng cụ thể.
 *
 *? Function:
 *    handleOpenFile()  : Mở file trong editor. Nếu có message.line → jump tới dòng + selection.
 *    handleOpenFolder(): Mở thư mục trong OS file manager.
 */
import * as path from "path";
import * as vscode from "vscode";

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
}
