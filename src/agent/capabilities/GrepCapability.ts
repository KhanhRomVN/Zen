/**
 *? Usage:
 *    Tìm kiếm regex trong file hoặc thư mục (đệ quy). Hỗ trợ fuzzy matching, tự động bỏ dấu tiếng Việt, bỏ qua thư mục/thư viện nhị phân.
 *
 *? Function:
 *    execute()              : Thực thi tìm kiếm, trả về kết quả theo file.
 *    createSearchPattern()  : Tạo regex pattern cho fuzzy matching (xử lý camelCase, snake_case, kebab-case).
 *    removeDiacritics()     : Loại bỏ dấu tiếng Việt và các ký tự có dấu khác.
 *    splitIntoWords()       : Tách chuỗi thành các từ, xử lý camelCase/snake_case/kebab-case.
 *    escapeRegex()          : Escape các ký tự đặc biệt trong regex.
 *    getAllFiles()          : Đệ quy lấy tất cả file trong thư mục (loại trừ thư mục hệ thống, file nhị phân).
 *    searchInFileWithStats(): Tìm kiếm regex trong một file, trả về matches + số dòng đã quét.
 */
import * as fs from "fs";
import * as path from "path";

// SERVICES
import { LoggerService } from "../../services/LoggerService";

// TYPES
import { AgentAction, AgentExecutionResult } from "../../types/Agent";

interface MatchResult {
  lineNumber: number;
  lineContent: string;
}

interface FileMatchResult {
  matches: MatchResult[];
}

export class GrepCapability {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  async execute(action: AgentAction): Promise<AgentExecutionResult> {
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

      // Use search_term as literal regex
      let regex: RegExp;
      try {
        regex = new RegExp(searchTerm, "i");
      } catch (regexError) {
        throw new Error(
          `Invalid regex pattern: ${searchTerm} - ${regexError instanceof Error ? regexError.message : String(regexError)}`,
        );
      }

      let filesToSearch: string[] = [];

      if (filePath) {
        // Single file — resolve relative to workspaceRoot
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(this.workspaceRoot, filePath);
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        filesToSearch = [resolvedPath];
      } else if (folderPath) {
        // Recursive folder search — resolve relative to workspaceRoot
        const resolvedFolder = path.isAbsolute(folderPath)
          ? folderPath
          : path.resolve(this.workspaceRoot, folderPath);
        if (!fs.existsSync(resolvedFolder)) {
          throw new Error(`Folder not found: ${folderPath}`);
        }
        filesToSearch = this.getAllFiles(resolvedFolder);
      }

      const results: Record<string, FileMatchResult> = {};
      let filesWithMatches = 0;
      let totalLinesScanned = 0;

      const searchStart = Date.now();
      for (const file of filesToSearch) {
        const { matches, linesScanned } = await this.searchInFileWithStats(
          file,
          regex,
        );

        totalLinesScanned += linesScanned;
        if (matches.length > 0) {
          results[file] = {
            matches,
          };
          filesWithMatches++;
        }
      }

      const totalMatches = Object.values(results).reduce(
        (sum, fileResult) => sum + fileResult.matches.length,
        0,
      );

      if (filesWithMatches === 0) {
        logger.warn(
          `[GREP] ⚠️ No matches found for "${searchTerm}" in ${filesToSearch.length} files`,
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
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[GREP] Error executing grep:`, error);
      return {
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Creates a regex pattern for fuzzy string matching.
   * "searchBar" -> "search[\\s_-]*bar"
   * "hello world" -> "hello[\\s_-]*world"
   */
  private createSearchPattern(searchTerm: string): string {
    // Convert to lowercase
    let normalized = searchTerm.toLowerCase();

    // Remove diacritics (basic Vietnamese and accents)
    normalized = this.removeDiacritics(normalized);

    // Split into words (camelCase, snake_case, kebab-case, spaces)
    const words = this.splitIntoWords(normalized);

    // Join words with pattern that allows separators
    return words.map((word) => this.escapeRegex(word)).join("[\\s_-]*");
  }

  /**
   * Remove diacritics from string (basic support for Vietnamese and other accents)
   */
  private removeDiacritics(str: string): string {
    const diacriticsMap: Record<string, string> = {
      à: "a",
      á: "a",
      ả: "a",
      ã: "a",
      ạ: "a",
      ă: "a",
      ằ: "a",
      ắ: "a",
      ẳ: "a",
      ẵ: "a",
      ặ: "a",
      â: "a",
      ầ: "a",
      ấ: "a",
      ẩ: "a",
      ẫ: "a",
      ậ: "a",
      è: "e",
      é: "e",
      ẻ: "e",
      ẽ: "e",
      ẹ: "e",
      ê: "e",
      ề: "e",
      ế: "e",
      ể: "e",
      ễ: "e",
      ệ: "e",
      ì: "i",
      í: "i",
      ỉ: "i",
      ĩ: "i",
      ị: "i",
      ò: "o",
      ó: "o",
      ỏ: "o",
      õ: "o",
      ọ: "o",
      ô: "o",
      ồ: "o",
      ố: "o",
      ổ: "o",
      ỗ: "o",
      ộ: "o",
      ơ: "o",
      ờ: "o",
      ớ: "o",
      ở: "o",
      ỡ: "o",
      ợ: "o",
      ù: "u",
      ú: "u",
      ủ: "u",
      ũ: "u",
      ụ: "u",
      ư: "u",
      ừ: "u",
      ứ: "u",
      ử: "u",
      ữ: "u",
      ự: "u",
      ỳ: "y",
      ý: "y",
      ỷ: "y",
      ỹ: "y",
      ỵ: "y",
      đ: "d",
    };

    return str.replace(
      /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/g,
      (match) => diacriticsMap[match] || match,
    );
  }

  /**
   * Split string into words, handling camelCase, snake_case, kebab-case, and spaces
   */
  private splitIntoWords(str: string): string[] {
    // Handle camelCase: "searchBar" -> ["search", "bar"]
    const withCamelSplit = str.replace(/([a-z])([A-Z])/g, "$1 $2");
    // Handle snake_case and kebab-case: replace _ and - with space
    const withSeparators = withCamelSplit.replace(/[_-]/g, " ");
    // Split by spaces and filter empty
    return withSeparators.split(/\s+/).filter((w) => w.length > 0);
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Recursively get all files in a directory (excluding node_modules, .git, etc.)
   * WARNING: This can be expensive for large directories!
   */
  private getAllFiles(
    dirPath: string,
    fileList: string[] = [],
    depth: number = 0,
  ): string[] {
    // Safety limit: prevent too deep recursion
    const MAX_DEPTH = 20;
    const MAX_FILES = 10000;

    if (depth > MAX_DEPTH) {
      return fileList;
    }

    if (fileList.length > MAX_FILES) {
      return fileList;
    }

    const files = fs.readdirSync(dirPath);

    const excludeDirs = new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "__pycache__",
      ".venv",
      "venv",
      "target",
      "out",
      ".idea",
      ".vscode",
    ]);
    const excludeExtensions = new Set([
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".pyc",
      ".class",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
    ]);

    for (const file of files) {
      const fullPath = path.join(dirPath, file);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (!excludeDirs.has(file) && !file.startsWith(".")) {
            this.getAllFiles(fullPath, fileList, depth + 1);
          }
        } else {
          const ext = path.extname(file).toLowerCase();
          if (!excludeExtensions.has(ext)) {
            fileList.push(fullPath);
          }
        }
      } catch (err) {
        // Skip files that can't be accessed (permission issues, etc.)
      }
    }

    return fileList;
  }

  /**
   * Search for pattern in a single file with statistics
   */
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
            lineNumber: i + 1, // 1-indexed line numbers
            lineContent: line.trim(),
          });
        }
      }
    } catch (error) {
      // Skip binary files or files that can't be read
    }

    return { matches, linesScanned };
  }
}
