import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

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
  ];

  /**
   * Lấy cấu trúc file tree của workspace
   */
  public async getFileTree(maxDepth: number = 3): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return "No workspace folder open";
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const tree = await this.buildFileTree(rootPath, 0, maxDepth);
    return this.formatFileTree(tree);
  }

  /**
   * Build file tree recursively
   */
  private async buildFileTree(
    dirPath: string,
    currentDepth: number,
    maxDepth: number
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
        (entry) => !this.shouldIgnore(entry)
      );

      for (const entry of filteredEntries) {
        const entryPath = path.join(dirPath, entry);
        try {
          const childNode = await this.buildFileTree(
            entryPath,
            currentDepth + 1,
            maxDepth
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
  private formatFileTree(node: FileNode, prefix: string = ""): string {
    let result = "";

    if (prefix === "") {
      result += `${node.name}/\n`;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach((child, index) => {
        const isLast = index === node.children!.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const childPrefix = isLast ? "    " : "│   ";

        result += `${prefix}${connector}${child.name}${
          child.type === "directory" ? "/" : ""
        }\n`;

        if (child.children && child.children.length > 0) {
          result += this.formatFileTree(child, prefix + childPrefix);
        }
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
   * Count total files in workspace
   */
  public async countFiles(): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return 0;
    }

    return this.countFilesRecursive(workspaceFolders[0].uri.fsPath);
  }

  private countFilesRecursive(dirPath: string): number {
    try {
      const stats = fs.statSync(dirPath);
      if (stats.isFile()) {
        return 1;
      }

      let count = 0;
      const entries = fs.readdirSync(dirPath);
      const filteredEntries = entries.filter(
        (entry) => !this.shouldIgnore(entry)
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
}
