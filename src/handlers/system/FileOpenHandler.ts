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
import * as fs from "fs";
import { spawn } from "child_process";

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
   * Mở một URL http/https trong browser mặc định của hệ điều hành.
   * Dùng cho các link quảng cáo/tài liệu hiển thị trong webview
   * (webview VSCode chặn `<a target="_blank">`, buộc phải đi qua extension host).
   */
  public async handleOpenExternalUrl(message: any) {
    const url = message.url;
    if (!url || typeof url !== "string") return;

    // Chỉ chấp nhận http/https để tránh abuse (vd: mở file://, command scheme...)
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return;
      }
    } catch {
      return;
    }

    try {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (error) {
      console.error("[FileOpenHandler] handleOpenExternalUrl error:", error);
    }
  }

  /**
   * Mở Chromium với profile cụ thể nhưng KHÔNG có CDP (không --remote-debugging-port).
   * Dùng cho device code flow: mở browser để user đăng nhập, không cần capture traffic.
   *
   * message.url             : URL cần mở (http/https bắt buộc)
   * message.userDataDir     : Đường dẫn tuyệt đối tới profile folder (optional)
   */
  public async handleOpenBrowserWithProfile(message: any) {
    const url = message.url as string | undefined;
    const userDataDir = message.userDataDir as string | undefined;

    if (!url || typeof url !== "string") return;

    // Chỉ chấp nhận http/https
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    } catch {
      return;
    }

    // Tìm executable Chromium (cùng logic với CDPService.findBrowserExecutable)
    const executable = this.findChromiumExecutable();

    if (!executable) {
      // Fallback: mở bằng OS default browser (không có profile)
      console.warn(
        "[FileOpenHandler] No Chromium found, falling back to openExternal"
      );
      try {
        await vscode.env.openExternal(vscode.Uri.parse(url));
      } catch {}
      return;
    }

    const args: string[] = [
      "--no-first-run",
      "--no-default-browser-check",
    ];

    if (userDataDir) {
      try {
        if (!fs.existsSync(userDataDir)) {
          fs.mkdirSync(userDataDir, { recursive: true });
        }
      } catch {}
      args.push(`--user-data-dir=${userDataDir}`);
    }

    args.push(url);

    try {
      const child = spawn(executable, args, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch (error) {
      console.error("[FileOpenHandler] handleOpenBrowserWithProfile error:", error);
      // Fallback
      try {
        await vscode.env.openExternal(vscode.Uri.parse(url));
      } catch {}
    }
  }

  /** Tìm executable Chromium/Chrome/Edge trên hệ thống — clone từ CDPService. */
  private findChromiumExecutable(): string {
    const nodePath = require("path") as typeof path;
    const nodeFs = require("fs") as typeof fs;

    if (process.platform === "win32") {
      const progFiles = process.env["ProgramFiles"] || "C:\\Program Files";
      const progFilesX86 =
        process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
      const localAppData =
        process.env["LocalAppData"] ||
        (process.env["USERPROFILE"]
          ? nodePath.join(process.env["USERPROFILE"], "AppData", "Local")
          : "");
      const candidates = [
        nodePath.join(progFiles, "Google", "Chrome", "Application", "chrome.exe"),
        nodePath.join(progFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
        nodePath.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
        nodePath.join(progFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
        nodePath.join(progFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
        nodePath.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
        nodePath.join(progFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        nodePath.join(progFilesX86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        nodePath.join(localAppData, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      ];
      for (const c of candidates) {
        if (c && nodeFs.existsSync(c)) return c;
      }
    } else if (process.platform === "darwin") {
      const candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      ];
      for (const c of candidates) {
        if (nodeFs.existsSync(c)) return c;
      }
    }

    // Linux / fallback: which
    const { execSync } = require("child_process") as typeof import("child_process");
    for (const b of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"]) {
      try {
        execSync(`which ${b}`, { stdio: "ignore" });
        return b;
      } catch {}
    }
    return "";
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
