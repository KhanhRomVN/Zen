/**
 *? Usage:
 *    Mở nội dung tạm trong editor: preview markdown/code, ảnh base64, và preview file sẽ được ghi.
 *
 *? Function:
 *    handleOpenTempImage()  : Mở ảnh base64 trong editor.
 *    handleOpenWriteToFile(): Mở preview nội dung file mới sẽ được ghi.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

// PROVIDERS
import { DiffProvider } from "../../providers/DiffProvider";

// SERVICES
import { PathService } from "../../services/PathService";

export class PreviewHandler {
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
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
      console.error("[PreviewHandler] handleOpenWriteToFile error:", error);
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }
}
