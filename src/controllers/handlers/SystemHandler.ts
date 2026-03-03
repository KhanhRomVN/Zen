import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { ThemeService } from "../../services/ThemeService";
import { ShikiService } from "../../services/ShikiService";

export class SystemHandler {
  constructor() {}

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
    await new Promise((resolve) => setTimeout(resolve, 150));
    const theme = vscode.window.activeColorTheme;
    const themeKind = theme.kind;
    const colorTheme =
      vscode.workspace
        .getConfiguration("workbench")
        .get<string>("colorTheme") || "Default Dark Modern";

    try {
      const themeJson = await ThemeService.getActiveThemeJson();
      if (themeJson) {
        await ShikiService.getInstance().setCustomTheme(themeJson, colorTheme);
      }
    } catch (e) {}

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
    if (!filePath) return;

    try {
      const uri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            filePath,
          );
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error) {}
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
}
