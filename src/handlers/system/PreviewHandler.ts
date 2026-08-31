/**
 *? Usage:
 *    Mở nội dung tạm trong editor: preview markdown/code, ảnh base64, và preview file sẽ được ghi.
 *
 *? Function:
 *    handleOpenTempImage()  : Mở ảnh base64 trong editor.
 *    handleOpenWriteToFile(): Mở preview nội dung file mới sẽ được ghi.
 *    handleOpenViewReplaceHistoryVersion(): Mở nội dung của version cụ thể trong lịch sử replace.
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

// MANAGERS
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";

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

  public async handleOpenViewReplaceHistoryVersion(message: any) {
    const { filePath, version } = message;

    if (!filePath || version === undefined) {
      console.error("[PreviewHandler] Missing filePath or version");
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found");
        return;
      }

      // Convert to absolute path nếu là relative path
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);

      // Lấy nội dung từ ReplaceInFileHistoryManager
      const historyManager = ReplaceInFileHistoryManager.getInstance();
      const historyVersion = await historyManager.getHistoryVersion(absolutePath, version);

      if (!historyVersion) {
        vscode.window.showErrorMessage(`Version ${version} not found for ${filePath}`);
        return;
      }

      const basename = path.basename(absolutePath);
      const ext = path.extname(basename);
      const nameWithoutExt = path.basename(basename, ext);
      const tempBasename = `${nameWithoutExt}_v${version}_TEMP${ext}`;

      // Tạo stable ID cho version này
      const stableId = `version_${Buffer.from(`${absolutePath}_v${version}`).toString("base64").replace(/[/+=]/g, "_").toLowerCase()}`;

      // Store nội dung vào DiffProvider
      DiffProvider.instance.store(stableId, historyVersion.fullContent);

      // Tạo URI
      const uri = DiffProvider.toUri(stableId, tempBasename);

      // Kiểm tra xem tab đã mở chưa
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

      // Mở tab mới
      await vscode.window.showTextDocument(uri, {
        preview: false,
        preserveFocus: false,
      });
    } catch (error) {
      console.error("[PreviewHandler] handleOpenViewReplaceHistoryVersion error:", error);
      vscode.window.showErrorMessage(`Failed to open version ${version}: ${error}`);
    }
  }
}
