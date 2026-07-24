/**
 *? Usage:
 *    Xử lý thực thi grep của AI agent: security check + regex search + trả kết quả về webview.
 *
 *? Function:
 *    handleGrep(): Security check path, thực thi grep, trả về kết quả qua postMessage.
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// SERVICES
import { LoggerService } from "../../services/LoggerService";

// VALIDATORS
import { SecurityValidator } from "../../utils/security";

// ─── Constants ────────────────────────────────────────────────────

const MAX_GREP_FILES = 500;
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB — bỏ qua file lớn hơn
const EXCLUDE_GREP_PATTERN =
  "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**,**/__pycache__/**,**/.venv/**,**/venv/**,**/target/**,**/out/**,**/.idea/**,**/.vscode/**}";

// ─── Types ────────────────────────────────────────────────────────

interface GrepAction {
  path?: string;
  content?: string;
  command?: string;
  search_term?: string;
  file_path?: string;
  folder_path?: string;
  requestId: string;
  timestamp: number;
}

interface GrepResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

// ─── Local interfaces ─────────────────────────────────────────────

interface MatchResult {
  lineNumber: number;
  lineContent: string;
}

interface FileMatchResult {
  matches: MatchResult[];
}

export class GrepHandler {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public async handleGrep(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const action: GrepAction = message.action;
    const requestId = action?.requestId;

    try {
      // Security check: validate the target path
      const rawPath = action.file_path || action.folder_path;
      if (rawPath) {
        const resolvedPath = path.isAbsolute(rawPath)
          ? rawPath
          : path.resolve(this.workspaceRoot, rawPath);
        const securityCheck = SecurityValidator.validatePath(
          resolvedPath,
          false,
        );
        if (!securityCheck.safe) {
          webviewView.webview.postMessage({
            command: "agentActionResult",
            requestId: action.requestId,
            result: {
              success: false,
              error: securityCheck.reason || "Security validation failed",
              timestamp: Date.now(),
            },
          });
          return;
        }
      }

      // Execute grep
      const result = await this.executeGrep(action);

      webviewView.webview.postMessage({
        command: "agentActionResult",
        requestId: action.requestId,
        result,
      });
    } catch (e: any) {
      console.error(`[Zen][GrepHandler] ❌ Grep failed:`, {
        requestId,
        error: e.message,
        stack: e.stack,
      });

      webviewView.webview.postMessage({
        command: "agentActionResult",
        requestId: action.requestId,
        result: { success: false, error: e.message },
      });
    }
  }

  // ─── Grep logic ──────────────────────────────────────────────────

  private async executeGrep(action: GrepAction): Promise<GrepResult> {
    const logger = LoggerService.getInstance();
    try {
      const searchTerm = action.search_term;
      const filePath = action.file_path;
      const folderPath = action.folder_path;

      if (!searchTerm || searchTerm.trim().length === 0) {
        throw new Error("Missing search term");
      }

      if (!filePath && !folderPath) {
        throw new Error("Either file_path or folder_path must be provided");
      }

      if (filePath && folderPath) {
        throw new Error(
          "Provide only one of file_path or folder_path, not both",
        );
      }

      let regex: RegExp;
      try {
        regex = new RegExp(searchTerm, "i");
      } catch (regexError) {
        throw new Error(
          `Invalid regex pattern: ${searchTerm} - ${
            regexError instanceof Error ? regexError.message : String(regexError)
          }`,
        );
      }

      let filesToSearch: string[] = [];
      let skippedLargeFiles = 0;

      if (filePath) {
        // ── Single file mode ──
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(this.workspaceRoot, filePath);
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        filesToSearch = [resolvedPath];
      } else if (folderPath) {
        // ── Folder mode: dùng VSCode API bất đồng bộ thay vì duyệt thủ công ──
        const resolvedFolder = path.isAbsolute(folderPath)
          ? folderPath
          : path.resolve(this.workspaceRoot, folderPath);

        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(resolvedFolder));
        } catch {
          throw new Error(`Folder not found: ${folderPath}`);
        }

        const uris = await vscode.workspace.findFiles(
          new vscode.RelativePattern(resolvedFolder, "**/*"),
          EXCLUDE_GREP_PATTERN,
          MAX_GREP_FILES,
        );

        filesToSearch = uris.map((uri) => uri.fsPath);

        if (filesToSearch.length === 0) {
          logger.warn(
            `[GREP] ⚠️ No searchable files found in "${folderPath}"`,
          );
        }
      }

      const results: Record<string, FileMatchResult> = {};
      let filesWithMatches = 0;
      let totalLinesScanned = 0;
      let filesSkippedSize = 0;

      for (const file of filesToSearch) {
        // Kiểm tra kích thước file trước khi đọc — bỏ qua file > MAX_FILE_SIZE_BYTES
        try {
          const stat = await fs.promises.stat(file);
          if (stat.size > MAX_FILE_SIZE_BYTES) {
            filesSkippedSize++;
            continue;
          }
        } catch {
          continue; // Không thể stat → bỏ qua
        }

        const { matches, linesScanned } = await this.searchInFileWithStats(
          file,
          regex,
        );

        totalLinesScanned += linesScanned;
        if (matches.length > 0) {
          results[file] = { matches };
          filesWithMatches++;
        }
      }

      const totalMatches = Object.values(results).reduce(
        (sum, fileResult) => sum + fileResult.matches.length,
        0,
      );

      if (filesWithMatches === 0) {
        logger.warn(
          `[GREP] ⚠️ No matches found for "${searchTerm}" in ${filesToSearch.length} files` +
            (filesSkippedSize > 0
              ? ` (${filesSkippedSize} large files skipped)`
              : ""),
        );
      }

      return {
        success: true,
        data: {
          searchTerm,
          pattern: regex.source,
          results,
          totalFilesSearched: filesToSearch.length,
          totalMatches,
          ...(filesSkippedSize > 0 ? { filesSkippedSize } : {}),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      LoggerService.getInstance().error(`[GREP] Error executing grep:`, error);
      return {
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
      };
    }
  }

  // ─── Search in single file ───────────────────────────────────────

  private async searchInFileWithStats(
    filePath: string,
    regex: RegExp,
  ): Promise<{ matches: MatchResult[]; linesScanned: number }> {
    const matches: MatchResult[] = [];
    let linesScanned = 0;

    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const lines = content.split(/\r?\n/);
      linesScanned = lines.length;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (regex.test(line)) {
          matches.push({
            lineNumber: i + 1,
            lineContent: line.trim(),
          });
        }
      }
    } catch (error) {
      // Skip binary files or files that can't be read
    }

    return { matches, linesScanned };
  }

  // ─── Fuzzy matching helpers (unused for now, kept from GrepCapability) ───

  private createSearchPattern(searchTerm: string): string {
    let normalized = searchTerm.toLowerCase();
    normalized = this.removeDiacritics(normalized);
    const words = this.splitIntoWords(normalized);
    return words.map((word) => this.escapeRegex(word)).join("[\\s_-]*");
  }

  private removeDiacritics(str: string): string {
    const diacriticsMap: Record<string, string> = {
      à: "a", á: "a", ả: "a", ã: "a", ạ: "a",
      ă: "a", ằ: "a", ắ: "a", ẳ: "a", ẵ: "a", ặ: "a",
      â: "a", ầ: "a", ấ: "a", ẩ: "a", ẫ: "a", ậ: "a",
      è: "e", é: "e", ẻ: "e", ẽ: "e", ẹ: "e",
      ê: "e", ề: "e", ế: "e", ể: "e", ễ: "e", ệ: "e",
      ì: "i", í: "i", ỉ: "i", ĩ: "i", ị: "i",
      ò: "o", ó: "o", ỏ: "o", õ: "o", ọ: "o",
      ô: "o", ồ: "o", ố: "o", ổ: "o", ỗ: "o", ộ: "o",
      ơ: "o", ờ: "o", ớ: "o", ở: "o", ỡ: "o", ợ: "o",
      ù: "u", ú: "u", ủ: "u", ũ: "u", ụ: "u",
      ư: "u", ừ: "u", ứ: "u", ử: "u", ữ: "u", ự: "u",
      ỳ: "y", ý: "y", ỷ: "y", ỹ: "y", ỵ: "y",
      đ: "d",
    };

    return str.replace(
      /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/g,
      (match) => diacriticsMap[match] || match,
    );
  }

  private splitIntoWords(str: string): string[] {
    const withCamelSplit = str.replace(/([a-z])([A-Z])/g, "$1 $2");
    const withSeparators = withCamelSplit.replace(/[_-]/g, " ");
    return withSeparators.split(/\s+/).filter((w) => w.length > 0);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}