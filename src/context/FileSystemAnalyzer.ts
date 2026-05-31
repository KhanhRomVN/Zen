import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { rgPath } from "@vscode/ripgrep";
const execAsync = promisify(exec);

export interface FileNode {
  name: string;
  type: "file" | "directory";
  path: string;
  lines?: number;
  children?: FileNode[];
}

export class FileSystemAnalyzer {
  /**
   * Patterns ignored when LISTING files (directory traversal).
   * Only system/build folders that are never useful to show.
   */
  private listingIgnoredPatterns = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "coverage",
    ".vscode",
    ".idea",
    ".DS_Store",
    "*.vsix",
  ];

  /**
   * Additional patterns ignored when building CONTENT context (on top of listingIgnoredPatterns).
   * Media, binary, and lock files that are not useful as text context for the AI.
   */
  private contentOnlyIgnoredPatterns = [
    "*.log",
    "*.map",
    // Media
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.webp",
    "*.svg",
    "*.ico",
    "*.mp4",
    "*.mp3",
    "*.wav",
    // Documents
    "*.pdf",
    "*.doc",
    "*.docx",
    "*.ppt",
    "*.pptx",
    "*.xls",
    "*.xlsx",
    // Binaries & Archives
    "*.exe",
    "*.dll",
    "*.so",
    "*.bin",
    "*.zip",
    "*.tar",
    "*.gz",
    "*.7z",
    "*.rar",
    "*.pyc",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ];

  /** Combined patterns (listing + content) — used for context building */
  private get ignoredPatterns(): string[] {
    return [...this.listingIgnoredPatterns, ...this.contentOnlyIgnoredPatterns];
  }

  private bypassedPaths: Set<string> = new Set();

  /**
   * Add a path to the bypass list for the current session
   */
  public addBypassPath(pathValue: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let absolutePath = pathValue;

    if (
      !path.isAbsolute(pathValue) &&
      workspaceFolders &&
      workspaceFolders.length > 0
    ) {
      absolutePath = path.join(workspaceFolders[0].uri.fsPath, pathValue);
    }

    absolutePath = path.normalize(absolutePath);

    this.bypassedPaths.add(absolutePath);
  }

  /**
   * Lấy cấu trúc file tree của workspace.
   * This is used for the Project Structure UI where we need to see everything.
   */
  public async getRawFileTree(maxDepth: number = 20): Promise<FileNode | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // For raw file tree, we still want to ignore standard system folders like node_modules.
    try {
      // Use efficient rg check first but with our standard ignore list
      return await this.buildFileTreeWithRg(rootPath, maxDepth);
    } catch (error) {
      return await this.buildFileTree(rootPath, 0, maxDepth, false);
    }
  }

  /**
   * Lấy cấu trúc file tree của một thư mục (mặc định là workspace root)
   */
  public async getFileTree(
    maxDepth: number = 20,
    customRootPath?: string,
    forListing: boolean = false,
  ): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (
      (!workspaceFolders || workspaceFolders.length === 0) &&
      !customRootPath
    ) {
      return "No workspace folder open";
    }

    const rootPath = customRootPath || workspaceFolders![0].uri.fsPath;

    try {
      const tree = await this.buildFileTreeWithRg(rootPath, maxDepth, true, forListing);
      return this.formatFileTree(tree);
    } catch (error) {
      const tree = await this.buildFileTree(rootPath, 0, maxDepth, true, forListing);
      return this.formatFileTree(tree);
    }
  }

  /**
   * Build file tree using ripgrep
   */
  private async buildFileTreeWithRg(
    rootPath: string,
    maxDepth: number,
    useBlacklist: boolean = false,
    forListing: boolean = false,
  ): Promise<FileNode> {
    // Check if bypass should apply to disable gitignore in rg
    let extraFlags = "";
    const normalizedRoot = path.normalize(rootPath);
    for (const bypassed of this.bypassedPaths) {
      if (
        normalizedRoot === bypassed ||
        normalizedRoot.startsWith(bypassed + path.sep)
      ) {
        extraFlags = "--no-ignore ";
        break;
      }
    }

    const root: FileNode = {
      name: path.basename(rootPath),
      type: "directory",
      path: rootPath,
      children: [],
    };

    const shouldIgnoreFn = forListing
      ? (name: string) => this.shouldIgnoreForListing(name)
      : (name: string) => this.shouldIgnore(name);

    // 1. Quét folder trực tiếp trước (Đảm bảo folder như src luôn có mặt)
    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (shouldIgnoreFn(entry.name)) {
          continue;
        }
        const entryPath = path.join(rootPath, entry.name);

        if (!root.children) root.children = [];
        if (!root.children.find((c) => c.name === entry.name)) {
          root.children.push({
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            path: entryPath,
            children: entry.isDirectory() ? [] : undefined,
          });
        }
      }
    } catch (e) {
    }

    // 2. Chạy Ripgrep để quét sâu hơn
    // When listing, use --no-ignore-vcs to include files rg would normally skip,
    // but still respect our listing ignore patterns applied manually above.
    const rgExtraFlags = forListing ? `${extraFlags}--no-ignore ` : extraFlags;
    const cmd = `"${rgPath}" ${rgExtraFlags}--files --max-depth ${maxDepth}`;
    const { stdout } = await execAsync(cmd, {
      cwd: rootPath,
      maxBuffer: 1024 * 1024 * 10,
    });
    const files = stdout.split("\n").filter((line) => line.trim() !== "");

    for (const fileRelativePath of files) {
      const parts = fileRelativePath.split(path.sep);

      // Skip if any path component matches the ignore filter
      if (parts.some((part) => shouldIgnoreFn(part))) {
        continue;
      }

      let currentNode = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = path.join(rootPath, ...parts.slice(0, i + 1));

        if (!currentNode.children) {
          currentNode.children = [];
        }

        let child = currentNode.children.find((c) => c.name === part);
        if (!child) {
          const lines = isFile
            ? await this.getFileLineCount(currentPath)
            : undefined;
          child = {
            name: part,
            type: isFile ? "file" : "directory",
            path: currentPath,
            lines,
            children: isFile ? undefined : [],
          };
          currentNode.children.push(child);
        }
        currentNode = child;
      }
    }

    this.sortFileTree(root);
    return root;
  }

  /**
   * Sort file tree nodes
   */
  private sortFileTree(node: FileNode) {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach((child) => this.sortFileTree(child));
    }
  }

  /**
   * Build file tree recursively
   */
  private async buildFileTree(
    dirPath: string,
    currentDepth: number,
    maxDepth: number,
    useBlacklist: boolean = true,
    forListing: boolean = false,
  ): Promise<FileNode> {
    const stats = fs.statSync(dirPath);
    const name = path.basename(dirPath);

    if (stats.isFile()) {
      const lines = await this.getFileLineCount(dirPath);
      return {
        name,
        type: "file",
        path: dirPath,
        lines,
      };
    }

    const node: FileNode = {
      name,
      type: "directory",
      path: dirPath,
      children: [],
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    const shouldIgnoreFn = forListing
      ? (n: string) => this.shouldIgnoreForListing(n)
      : (n: string) => this.shouldIgnore(n);

    try {
      const entries = fs.readdirSync(dirPath);
      const filteredEntries = entries.filter((entry) => !shouldIgnoreFn(entry));

      for (const entry of filteredEntries) {
        const entryPath = path.join(dirPath, entry);

        try {
          const childNode = await this.buildFileTree(
            entryPath,
            currentDepth + 1,
            maxDepth,
            useBlacklist,
            forListing,
          );
          node.children?.push(childNode);
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      // Sort: directories first, then files
      node.children?.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      // Directory can't be read
    }

    return node;
  }

  /**
   * Format file tree as string
   */
  /**
   * Format file tree as string with indentation
   */
  private formatFileTree(node: FileNode, depth: number = -1): string {
    let result = "";

    // Skip printing the root node (depth -1)
    if (depth >= 0) {
      const indent = "  ".repeat(depth);
      const suffix = node.type === "directory" ? "/" : "";
      const lineCount =
        node.type === "file" && node.lines !== undefined
          ? ` (${node.lines} lines)`
          : "";
      result += `${indent}${node.name}${suffix}${lineCount}\n`;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const nextDepth = depth === -1 ? 0 : depth + 1;
        result += this.formatFileTree(child, nextDepth);
      });
    }

    return result;
  }

  /**
   * Check if file/folder should be ignored for LISTING purposes.
   * Only filters system/build folders — media and binary files are still shown.
   */
  public shouldIgnoreForListing(name: string): boolean {
    return this.matchesPatterns(name, this.listingIgnoredPatterns);
  }

  /**
   * Check if file/folder should be ignored for CONTENT context purposes.
   * Filters system folders AND media/binary/lock files.
   */
  public shouldIgnore(name: string): boolean {
    return this.matchesPatterns(name, this.ignoredPatterns);
  }

  private matchesPatterns(name: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern.includes("*")) {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$";
        const regex = new RegExp(regexStr);
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  /**
   * Unified check if a path is ignored (by pattern, blacklist, or .gitignore)
   */
  public async isIgnored(filePath: string): Promise<{
    ignored: boolean;
    reason?: "pattern" | "gitignore";
  }> {
    const result = await this.performIgnoreCheck(filePath);
    return result;
  }

  private async performIgnoreCheck(filePath: string): Promise<{
    ignored: boolean;
    reason?: "pattern" | "gitignore";
  }> {
    // 0. Check if path or any parent is bypassed
    const normalizedFilePath = path.normalize(
      path.isAbsolute(filePath)
        ? filePath
        : path.join(this.getWorkspaceRoot() || "", filePath),
    );

    for (const bypassed of this.bypassedPaths) {
      if (
        normalizedFilePath === bypassed ||
        normalizedFilePath.startsWith(bypassed + path.sep)
      ) {
        return { ignored: false };
      }
    }

    // 1. Check predefined patterns
    if (this.shouldIgnore(path.basename(filePath))) {
      return { ignored: true, reason: "pattern" };
    }

    // 2. Check .gitignore using git check-ignore
    const workspaceRoot = this.getWorkspaceRoot();
    if (workspaceRoot) {
      try {
        const relativePath = path.relative(workspaceRoot, filePath);
        // Skip check-ignore for files outside workspace or the workspace root itself
        if (!relativePath.startsWith("..") && relativePath !== "") {
          const { stdout } = await execAsync(
            `git check-ignore "${relativePath}"`,
            {
              cwd: workspaceRoot,
            },
          );
          if (stdout.trim().length > 0) {
            return { ignored: true, reason: "gitignore" };
          }
        }
      } catch (error: any) {
        // git check-ignore returns exit code 1 if file is NOT ignored, which is caught here
        // We only care if it actually found a match (exit code 0)
      }
    }

    return { ignored: false };
  }

  private isBlacklisted(_filePath: string): boolean {
    return false;
  }

  /**
   * Count total files in workspace
   */
  public async countFiles(): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return 0;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    try {
      // Note: countFiles with rg might need adjustment to respect blacklist if we want total *active* files
      // But rg --files doesn't easily support dynamic exclude lists of absolute paths without a flag file.
      // For now, let's keep it simple and just count everything or implement a recursive count if blacklist is critical here.
      // Given the use case, counting *all* files (even blacklisted) might be misleading if we're generating context.
      // So falling back to recursive count which supports blacklist is safer.
      return this.countFilesRecursive(rootPath);
    } catch (error) {
      return this.countFilesRecursive(rootPath);
    }
  }

  public countFilesRecursive(dirPath: string): number {
    try {
      const stats = fs.statSync(dirPath);
      if (stats.isFile()) {
        return 1;
      }

      let count = 0;
      const entries = fs.readdirSync(dirPath);
      const filteredEntries = entries.filter(
        (entry) => !this.shouldIgnore(entry),
      );

      for (const entry of filteredEntries) {
        const entryPath = path.join(dirPath, entry);
        try {
          count += this.countFilesRecursive(entryPath);
        } catch (error) {
          continue;
        }
      }

      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get folder paths only (ordered from outside-in)
   * Returns relative paths from workspace root
   */
  /**
   * Get folder paths (ordered from outside-in) with file counts
   * Returns relative paths from workspace root and file count
   */
  public async getFolderPaths(
    maxDepth: number = 5,
  ): Promise<{ path: string; count: number }[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const folderCounts = new Map<string, number>();

    try {
      // Use ripgrep to get all files, then extract folder paths
      const { stdout } = await execAsync(
        `"${rgPath}" --files`, // Get ALL files to count correctly, ignore maxDepth for counting
        {
          cwd: rootPath,
          maxBuffer: 1024 * 1024 * 10,
        },
      );

      const files = stdout.split("\n").filter((line) => line.trim() !== "");

      for (const file of files) {
        const fullPath = path.join(rootPath, file);

        // Extract all parent directories
        const parts = file.split(path.sep);
        for (let i = 0; i < parts.length - 1; i++) {
          const folderPath = parts.slice(0, i + 1).join(path.sep);
          const fullFolderPath = path.join(rootPath, folderPath);

          // Calculate depth based on relative path
          const depth = folderPath.split(path.sep).length;
          if (depth > maxDepth) continue;

          // Increment count
          folderCounts.set(folderPath, (folderCounts.get(folderPath) || 0) + 1);
        }
      }
    } catch (error) {
      // Fallback to recursive method
      this.collectFolderCountsRecursiveHelper(
        rootPath,
        rootPath,
        0,
        maxDepth,
        folderCounts,
      );
    }

    // Convert to array and sort (outside-in)
    const sortedFolders = Array.from(folderCounts.entries()).map(
      ([p, count]) => ({ path: p, count }),
    );

    sortedFolders.sort((a, b) => {
      const depthA = a.path.split(path.sep).length;
      const depthB = b.path.split(path.sep).length;

      // Sort by depth first (shallower first)
      if (depthA !== depthB) {
        return depthA - depthB;
      }

      // Then alphabetically
      return a.path.localeCompare(b.path);
    });

    return sortedFolders;
  }

  /**
   * Get file line count
   */
  public async getFileLineCount(filePath: string): Promise<number> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return 0;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(rootPath, filePath);

      const stat = await fs.promises.stat(fullPath);
      // Skip files larger than 10MB or binary file extensions
      const binaryExts = /\.(a|o|so|dll|exe|bin|lib|obj|pyc|class|wasm)$/i;
      if (stat.size > 10 * 1024 * 1024 || binaryExts.test(fullPath)) {
        return 0;
      }

      const content = await fs.promises.readFile(fullPath, "utf-8");
      return content.split("\n").length;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Collect folder counts recursively (fallback method)
   */
  private collectFolderCountsRecursiveHelper(
    rootPath: string,
    currentPath: string,
    currentDepth: number,
    maxDepth: number,
    folderCounts: Map<string, number>,
  ): number {
    try {
      let totalFiles = 0;
      const entries = fs.readdirSync(currentPath);

      for (const entry of entries) {
        if (this.shouldIgnore(entry)) continue;

        const entryPath = path.join(currentPath, entry);

        const stat = fs.statSync(entryPath);
        if (stat.isFile()) {
          totalFiles++;
        } else if (stat.isDirectory()) {
          const childCount = this.collectFolderCountsRecursiveHelper(
            rootPath,
            entryPath,
            currentDepth + 1,
            maxDepth,
            folderCounts,
          );
          totalFiles += childCount;
        }
      }

      // Only add to folderCounts if within maxDepth
      if (currentDepth <= maxDepth && currentPath !== rootPath) {
        const relativePath = path.relative(rootPath, currentPath);
        folderCounts.set(relativePath, totalFiles);
      }

      return totalFiles;
    } catch {
      return 0;
    }
  }

  /**
   * Convert absolute file paths to relative paths
   */
  public getRelativeFilePaths(absolutePaths: string[]): string[] {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return absolutePaths;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    return absolutePaths.map((absolutePath) => {
      return path.relative(rootPath, absolutePath);
    });
  }

  /**
   * Get workspace root path
   */
  public getWorkspaceRoot(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }
    return workspaceFolders[0].uri.fsPath;
  }
}
