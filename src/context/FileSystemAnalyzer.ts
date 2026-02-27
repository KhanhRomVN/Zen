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
  children?: FileNode[];
}

export class FileSystemAnalyzer {
  private ignoredPatterns = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "coverage",
    ".vscode",
    ".idea",
    "*.log",
    ".DS_Store",
    "*.vsix",
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

  private blacklist: Set<string> = new Set();

  /**
   * Set the blacklist of files/folders
   */
  public setBlacklist(paths: string[]) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.blacklist = new Set(paths);
      return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;

    // Resolve all paths to absolute paths
    const absolutePaths = paths.map((p) => {
      if (path.isAbsolute(p)) return p;
      return path.join(rootPath, p);
    });

    this.blacklist = new Set(absolutePaths);
  }

  /**
   * Lấy cấu trúc file tree của workspace (ignoring blacklist)
   * This is used for the Project Structure UI where we need to see everything
   */
  public async getRawFileTree(maxDepth: number = 5): Promise<FileNode | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // For raw file tree, we still want to ignore standard system folders like node_modules
    // but NOT the user defined blacklist
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
    maxDepth: number = 3,
    customRootPath?: string,
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
      // Pass true for useBlacklist
      const tree = await this.buildFileTreeWithRg(rootPath, maxDepth, true);
      return this.formatFileTree(tree);
    } catch (error) {
      const tree = await this.buildFileTree(rootPath, 0, maxDepth, true);
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
  ): Promise<FileNode> {
    const { stdout } = await execAsync(
      `"${rgPath}" --files --max-depth ${maxDepth}`,
      {
        cwd: rootPath,
        maxBuffer: 1024 * 1024 * 10,
      },
    );
    const files = stdout.split("\n").filter((line) => line.trim() !== "");

    const root: FileNode = {
      name: path.basename(rootPath),
      type: "directory",
      path: rootPath,
      children: [],
    };

    for (const fileRelativePath of files) {
      // Check blacklist if enabled
      if (useBlacklist) {
        const fullPath = path.join(rootPath, fileRelativePath);
        if (this.isBlacklisted(fullPath)) {
          continue;
        }
      }

      const parts = fileRelativePath.split(path.sep);
      let currentNode = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = path.join(rootPath, ...parts.slice(0, i + 1));

        // Also check intermediate directories against blacklist if using blacklist
        if (useBlacklist && this.isBlacklisted(currentPath)) {
          break; // Stop processing this branch
        }

        if (!currentNode.children) {
          currentNode.children = [];
        }

        let child = currentNode.children.find((c) => c.name === part);
        if (!child) {
          child = {
            name: part,
            type: isFile ? "file" : "directory",
            path: currentPath,
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
  ): Promise<FileNode> {
    const stats = fs.statSync(dirPath);
    const name = path.basename(dirPath);

    if (stats.isFile()) {
      return {
        name,
        type: "file",
        path: dirPath,
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

    try {
      const entries = fs.readdirSync(dirPath);
      const filteredEntries = entries.filter(
        (entry) => !this.shouldIgnore(entry),
      );

      for (const entry of filteredEntries) {
        const entryPath = path.join(dirPath, entry);

        // Check blacklist
        if (useBlacklist && this.isBlacklisted(entryPath)) {
          continue;
        }

        try {
          const childNode = await this.buildFileTree(
            entryPath,
            currentDepth + 1,
            maxDepth,
            useBlacklist,
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
      result += `${indent}${node.name}${suffix}\n`;
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
   * Check if file/folder should be ignored
   */
  private shouldIgnore(name: string): boolean {
    return this.ignoredPatterns.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace("*", ".*"));
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  /**
   * Check if path is in blacklist
   */
  private isBlacklisted(filePath: string): boolean {
    // Check exact match
    if (this.blacklist.has(filePath)) {
      return true;
    }

    // Check if parent directory is in blacklist
    for (const ignoredPath of this.blacklist) {
      if (
        filePath.startsWith(ignoredPath + path.sep) ||
        filePath === ignoredPath
      ) {
        return true;
      }
    }

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
      // Check blacklist
      if (this.isBlacklisted(dirPath)) {
        return 0;
      }

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

        // Check blacklist
        if (this.isBlacklisted(fullPath)) {
          continue;
        }

        // Extract all parent directories
        const parts = file.split(path.sep);
        for (let i = 0; i < parts.length - 1; i++) {
          const folderPath = parts.slice(0, i + 1).join(path.sep);
          const fullFolderPath = path.join(rootPath, folderPath);

          // Check blacklist for the folder itself
          if (this.isBlacklisted(fullFolderPath)) {
            continue;
          }

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

      const content = await fs.promises.readFile(fullPath, "utf-8");
      return content.split("\n").length;
    } catch {
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
      // Check blacklist
      if (this.isBlacklisted(currentPath)) return 0;

      let totalFiles = 0;
      const entries = fs.readdirSync(currentPath);

      for (const entry of entries) {
        if (this.shouldIgnore(entry)) continue;

        const entryPath = path.join(currentPath, entry);
        if (this.isBlacklisted(entryPath)) continue;

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
