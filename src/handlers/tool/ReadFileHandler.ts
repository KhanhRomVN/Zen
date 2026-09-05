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
import pdfParse from "pdf-parse";
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
  private getFileType(
    filePath: string,
  ): "text" | "docx" | "pdf" | "rtf" | "odt" | "epub" | "unknown" {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".docx") return "docx";
    if (ext === ".pdf") return "pdf";
    if (ext === ".rtf") return "rtf";
    if (ext === ".odt") return "odt";
    if (ext === ".epub") return "epub";

    // Text file extensions
    const textExtensions = [
      ".txt",
      ".md",
      ".json",
      ".xml",
      ".html",
      ".css",
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".hpp",
      ".cs",
      ".php",
      ".rb",
      ".go",
      ".rs",
      ".swift",
      ".kt",
      ".scala",
      ".yml",
      ".yaml",
      ".toml",
      ".ini",
      ".cfg",
      ".conf",
      ".sh",
      ".bat",
      ".ps1",
      ".sql",
      ".r",
      ".m",
      ".pl",
      ".lua",
      ".vim",
      ".el",
      ".clj",
      ".fs",
      ".ml",
      ".hs",
      ".erl",
      ".ex",
      ".exs",
      ".dart",
      ".groovy",
      ".gradle",
      ".properties",
      ".env",
      ".gitignore",
      ".log",
      ".csv",
      ".tsv",
      ".svg",
      ".dockerfile",
      ".makefile",
    ];

    if (textExtensions.includes(ext) || ext === "") return "text";
    return "unknown";
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
   * Đọc nội dung file RTF
   */
  private async readRtfFile(filePath: string): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        const rtfParser = new RtfParser();
        let text = "";

        rtfParser.on("data", (data: any) => {
          if (data.type === "text") {
            text += data.value;
          }
        });

        rtfParser.on("end", () => {
          resolve(text);
        });

        rtfParser.on("error", (error: any) => {
          reject(new Error(`Failed to parse RTF: ${error.message}`));
        });

        stream.pipe(rtfParser);
      });
    } catch (error: any) {
      throw new Error(`Failed to read RTF file: ${error.message}`);
    }
  }

  /**
   * Đọc nội dung file ODT (OpenDocument Text)
   */
  private async readOdtFile(filePath: string): Promise<string> {
    try {
      const data = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(data);
      const contentXml = await zip.file("content.xml")?.async("string");

      if (!contentXml) {
        throw new Error("content.xml not found in ODT file");
      }

      return new Promise((resolve, reject) => {
        parseString(contentXml, (err, result) => {
          if (err) {
            reject(new Error(`Failed to parse ODT XML: ${err.message}`));
            return;
          }

          // Extract text from XML structure
          const extractText = (obj: any): string => {
            if (typeof obj === "string") return obj;
            if (Array.isArray(obj)) return obj.map(extractText).join("");
            if (obj && typeof obj === "object") {
              return Object.values(obj).map(extractText).join(" ");
            }
            return "";
          };

          const text = extractText(result);
          resolve(text);
        });
      });
    } catch (error: any) {
      throw new Error(`Failed to read ODT file: ${error.message}`);
    }
  }

  /**
   * Đọc nội dung file EPUB
   */
  private async readEpubFile(filePath: string): Promise<string> {
    try {
      const data = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(data);
      let allText = "";

      // Find all HTML/XHTML files in the EPUB
      const htmlFiles = Object.keys(zip.files).filter(
        (filename) => filename.endsWith(".html") || filename.endsWith(".xhtml"),
      );

      for (const filename of htmlFiles) {
        const content = await zip.file(filename)?.async("string");
        if (content) {
          // Remove HTML tags to get plain text
          const plainText = content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          allText += plainText + "\n\n";
        }
      }

      return allText;
    } catch (error: any) {
      throw new Error(`Failed to read EPUB file: ${error.message}`);
    }
  }

  /**
   * Đọc file text với auto-detect encoding
   */
  private async readTextFileWithEncoding(absPath: vscode.Uri): Promise<string> {
    try {
      const buffer = await vscode.workspace.fs.readFile(absPath);

      // Try UTF-8 first
      try {
        return Buffer.from(buffer).toString("utf8");
      } catch {
        // If UTF-8 fails, try to detect encoding
        const detectedEncoding = this.detectEncoding(buffer);
        return iconv.decode(Buffer.from(buffer), detectedEncoding);
      }
    } catch (error: any) {
      throw new Error(`Failed to read text file: ${error.message}`);
    }
  }

  /**
   * Detect encoding của file (simple detection)
   */
  private detectEncoding(buffer: Uint8Array): string {
    // Check for BOM
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xef &&
      buffer[1] === 0xbb &&
      buffer[2] === 0xbf
    ) {
      return "utf8"; // UTF-8 BOM
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      return "utf16le"; // UTF-16 LE BOM
    }
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
      return "utf16be"; // UTF-16 BE BOM
    }

    // Default fallbacks
    return "utf8";
  }

  /**
   * Đọc nội dung file dựa trên loại file
   */
  private async readFileContent(absPath: vscode.Uri): Promise<string> {
    const filePath = absPath.fsPath;
    const fileType = this.getFileType(filePath);

    switch (fileType) {
      case "docx":
        return await this.readDocxFile(filePath);

      case "pdf":
        return await this.readPdfFile(filePath);

      case "rtf":
        return await this.readRtfFile(filePath);

      case "odt":
        return await this.readOdtFile(filePath);

      case "epub":
        return await this.readEpubFile(filePath);

      case "text":
        return await this.readTextFileWithEncoding(absPath);

      default:
        // Try to read as text with encoding detection
        try {
          return await this.readTextFileWithEncoding(absPath);
        } catch (e: any) {
          throw new Error(
            `Unsupported file format or failed to read: ${e.message}`,
          );
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
      let diagnosticsMessage: string | null = null;

      if (!message.skipDiagnostics) {
        const diagResult = await diagnosticsService.getDiagnostics(
          absPath,
          pathValue,
          undefined, // Use default wait time from DiagnosticsService
        );
        diagnostics = diagResult.diagnostics;
        
        // Create suggestion message if timeout or incomplete
        if (diagResult.skippedReason === "timeout_no_diagnostics") {
          diagnosticsMessage = "⏱️ Language Server timeout while fetching diagnostics. File may still be analyzing.";
        } else if (diagResult.skippedReason === "possibly_incomplete") {
          diagnosticsMessage = "⚠️ Language Server may still be analyzing. Consider retrying if you expect errors.";
        } else if (diagResult.skippedReason === "file_too_large") {
          diagnosticsMessage = "📁 File too large (>100KB) - diagnostics skipped to avoid performance issues.";
        }
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
        diagnosticsMessage: diagnosticsMessage,
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
