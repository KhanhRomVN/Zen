/**
 * ------------------------------------------------------------------
 * Read File Handler
 * ------------------------------------------------------------------
 * Đọc nội dung file trong workspace, hỗ trợ:
 * - Text files thuần (txt, md, code, etc.)
 * - DOCX files (Microsoft Word)
 * - PDF files
 * - Đọc theo dòng (start_line/end_line)
 * - Security check, diagnostics, và hàng đợi tuần tự
 *
 * Main functions:
 * - handleReadFile() : Đọc file với queue, chờ diagnostics từ language
 *                      server, trả về nội dung + lỗi/cảnh báo
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";
import * as path from "path";
import { Buffer } from "buffer";

// ── VSCode ──
import * as vscode from "vscode";

// ── Services ──
import { DiagnosticsService } from "../../services/DiagnosticsService";
import { LoggerService } from "../../services/LoggerService";
import { PathService } from "../../services/PathService";

// ── Security ──
import { SecurityValidator } from "../../utils/security";

// ── Document Parsers ──
import * as mammoth from "mammoth";
import * as pdfParse from "pdf-parse";
import * as iconv from "iconv-lite";
import * as JSZip from "jszip";
import { parseString } from "xml2js";
const RtfParser = require("rtf-parser");

// ─── Class ──────────────────────────────────────────────────────────────
export class ReadFileHandler {
  private _readFileQueue: Promise<void> = Promise.resolve();
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
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

  /**
   * Kiểm tra file extension để xác định loại file
   */
  private getFileType(filePath: string): 'text' | 'docx' | 'pdf' | 'unknown' {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.docx') return 'docx';
    if (ext === '.pdf') return 'pdf';
    
    // Text file extensions
    const textExtensions = [
      '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts',
      '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
      '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat',
      '.ps1', '.sql', '.r', '.m', '.pl', '.lua', '.vim', '.el',
      '.clj', '.fs', '.ml', '.hs', '.erl', '.ex', '.exs', '.dart',
      '.groovy', '.gradle', '.properties', '.env', '.gitignore',
      '.log', '.csv', '.tsv', '.svg', '.dockerfile', '.makefile'
    ];
    
    if (textExtensions.includes(ext) || ext === '') return 'text';
    return 'unknown';
  }

  /**
   * Đọc nội dung file DOCX
   */
  private async readDocxFile(filePath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error: any) {
      throw new Error(`Failed to read DOCX file: ${error.message}`);
    }
  }

  /**
   * Đọc nội dung file PDF
   */
  private async readPdfFile(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error: any) {
      throw new Error(`Failed to read PDF file: ${error.message}`);
    }
  }

  /**
   * Đọc nội dung file dựa trên loại file
   */
  private async readFileContent(absPath: vscode.Uri): Promise<string> {
    const filePath = absPath.fsPath;
    const fileType = this.getFileType(filePath);

    switch (fileType) {
      case 'docx':
        return await this.readDocxFile(filePath);
      
      case 'pdf':
        return await this.readPdfFile(filePath);
      
      case 'text':
        try {
          return Buffer.from(
            await vscode.workspace.fs.readFile(absPath),
          ).toString("utf8");
        } catch (e: any) {
          throw new Error(`Failed to read text file: ${e.message}`);
        }
      
      default:
        // Try to read as text anyway
        try {
          return Buffer.from(
            await vscode.workspace.fs.readFile(absPath),
          ).toString("utf8");
        } catch (e: any) {
          throw new Error(`Unsupported file format or failed to read: ${e.message}`);
        }
    }
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
      absPath = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        pathValue,
      );

      const securityCheck = SecurityValidator.validatePath(
        absPath.fsPath,
        false,
      );
      if (!securityCheck.safe)
        throw new Error(securityCheck.reason || "Security validation failed");

      if (!fs.existsSync(absPath.fsPath)) {
        throw new Error(`File not found: ${pathValue}`);
      }

      const logger = LoggerService.getInstance();
      const diagnosticsService = DiagnosticsService.getInstance();

      let diagnostics: Array<{
        severity: string;
        message: string;
        line: number;
        column: number;
        source?: string;
        code?: string | number;
      }> = [];

      if (!message.skipDiagnostics) {
        const diagResult = await diagnosticsService.getDiagnostics(
          absPath,
          pathValue,
          15000,
        );
        diagnostics = diagResult.diagnostics;
      }

      let content = "";
      try {
        content = await this.readFileContent(absPath);
      } catch (e: any) {
        throw e;
      }

      const startLine = message.start_line ?? message.startLine;
      const endLine = message.end_line ?? message.endLine;
      if (startLine !== undefined) {
        const lines = content.split(/\r?\n/);
        const end = endLine !== undefined ? endLine + 1 : lines.length;
        content = lines.slice(startLine || 0, end).join("\n");
      }

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
