import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ImportNode } from "./types";

/**
 * Import/Dependency graph analyzer
 * Builds dependency tree by parsing import statements
 */
export class ImportGraphAnalyzer {
  private importCache = new Map<string, ImportNode>();

  /**
   * Get dependencies for a file with depth control
   */
  public async getDependencies(
    filePath: string,
    maxDepth: number = 2
  ): Promise<string[]> {
    const dependencies = new Set<string>();
    const visited = new Set<string>();

    await this.traverseDependencies(
      filePath,
      0,
      maxDepth,
      dependencies,
      visited,
      "forward"
    );

    return Array.from(dependencies);
  }

  /**
   * Get dependents (files that import this file) with depth control
   */
  public async getDependents(
    filePath: string,
    maxDepth: number = 2
  ): Promise<string[]> {
    const dependents = new Set<string>();
    const visited = new Set<string>();

    await this.traverseDependencies(
      filePath,
      0,
      maxDepth,
      dependents,
      visited,
      "backward"
    );

    return Array.from(dependents);
  }

  /**
   * Get both dependencies and dependents
   */
  public async getRelatedFiles(
    filePath: string,
    maxDepth: number = 2
  ): Promise<string[]> {
    const [dependencies, dependents] = await Promise.all([
      this.getDependencies(filePath, maxDepth),
      this.getDependents(filePath, maxDepth),
    ]);

    const result = [...new Set([...dependencies, ...dependents])];
    return result;
  }

  /**
   * Traverse dependency graph
   */
  private async traverseDependencies(
    filePath: string,
    currentDepth: number,
    maxDepth: number,
    result: Set<string>,
    visited: Set<string>,
    direction: "forward" | "backward"
  ): Promise<void> {
    if (currentDepth > maxDepth || visited.has(filePath)) {
      return;
    }

    visited.add(filePath);

    // Get or build import node
    let node = this.importCache.get(filePath);
    if (!node) {
      node = await this.buildImportNode(filePath);
      this.importCache.set(filePath, node);
    }

    // Get next files to traverse
    const nextFiles = direction === "forward" ? node.imports : node.importedBy;

    for (const nextFile of nextFiles) {
      if (nextFile !== filePath) {
        result.add(nextFile);
        await this.traverseDependencies(
          nextFile,
          currentDepth + 1,
          maxDepth,
          result,
          visited,
          direction
        );
      }
    }
  }

  /**
   * Build import node by parsing file
   */
  private async buildImportNode(filePath: string): Promise<ImportNode> {
    const imports = await this.parseImports(filePath);
    const importedBy = await this.findImporters(filePath);

    return {
      path: filePath,
      imports,
      importedBy,
      depth: 0,
    };
  }

  /**
   * Parse import statements from a file
   */
  private async parseImports(filePath: string): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const imports = new Set<string>();
      const dir = path.dirname(filePath);

      // Match various import patterns
      const patterns = [
        // ES6 imports: import ... from "..."
        /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["']/g,
        // CommonJS: require("...")
        /require\s*\(\s*["']([^"']+)["']\s*\)/g,
        // Dynamic imports: import("...")
        /import\s*\(\s*["']([^"']+)["']\s*\)/g,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];

          // Skip node_modules imports
          if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
            continue;
          }

          // Resolve relative path
          const resolvedPath = this.resolveImportPath(importPath, dir);
          if (resolvedPath && fs.existsSync(resolvedPath)) {
            imports.add(resolvedPath);
          }
        }
      }

      return Array.from(imports);
    } catch (error) {
      return [];
    }
  }

  /**
   * Resolve import path to absolute file path
   */
  private resolveImportPath(
    importPath: string,
    fromDir: string
  ): string | null {
    try {
      // Handle relative paths
      let resolvedPath = path.resolve(fromDir, importPath);

      // Try with extensions if file doesn't exist
      if (!fs.existsSync(resolvedPath)) {
        const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
        for (const ext of extensions) {
          const withExt = resolvedPath + ext;
          if (fs.existsSync(withExt)) {
            return withExt;
          }
        }

        // Try index files
        for (const ext of extensions) {
          const indexPath = path.join(resolvedPath, `index${ext}`);
          if (fs.existsSync(indexPath)) {
            return indexPath;
          }
        }

        return null;
      }

      return resolvedPath;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find files that import the given file
   */
  /**
   * Find files that import the given file
   */
  private async findImporters(filePath: string): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const importers = new Set<string>();
    const rootPath = workspaceFolders[0].uri.fsPath;
    const fileName = path.basename(filePath, path.extname(filePath));

    // Try using git grep first (fastest, respects .gitignore)
    try {
      const { stdout } = await require("util").promisify(
        require("child_process").exec
      )(`git grep --name-only "${fileName}"`, {
        cwd: rootPath,
        maxBuffer: 1024 * 1024 * 10,
      });

      const candidates = stdout
        .split("\n")
        .filter((f: string) => f.trim() !== "");

      for (const relativePath of candidates) {
        const fileFsPath = path.join(rootPath, relativePath);
        if (fileFsPath === filePath) continue;

        // Verify actual import
        const imports = await this.parseImports(fileFsPath);
        if (imports.includes(filePath)) {
          importers.add(fileFsPath);
        }
      }
      return Array.from(importers);
    } catch (error: any) {
      // git grep returns 1 if not found
      if (error.code === 1) {
        return [];
      }
      // If git fails (e.g. not a git repo), fall through to grep
    }

    // Try using standard grep with strict excludes
    try {
      // Exclude common heavy directories
      const excludes = `--exclude-dir={node_modules,.git,dist,out,build,.next,coverage}`;
      // Only search in ts/js files
      const includes = `--include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"`;

      const { stdout } = await require("util").promisify(
        require("child_process").exec
      )(`grep -l -r ${excludes} ${includes} "${fileName}" .`, {
        cwd: rootPath,
        maxBuffer: 1024 * 1024 * 10,
      });

      const candidates = stdout
        .split("\n")
        .filter((f: string) => f.trim() !== "");

      for (const relativePath of candidates) {
        const fileFsPath = path.join(rootPath, relativePath);
        if (fileFsPath === filePath) continue;

        // Verify actual import
        const imports = await this.parseImports(fileFsPath);
        if (imports.includes(filePath)) {
          importers.add(fileFsPath);
        }
      }

      return Array.from(importers);
    } catch (error: any) {
      // grep returns exit code 1 if no matches found
      if (error.code === 1) {
        // No files import this file, which is fine
        return [];
      }

      // Fallback to slower method if real error (e.g. grep not found)
      console.warn(
        "[ImportGraphAnalyzer] Grep failed, falling back to slow search:",
        error.message
      );
    }

    // Fallback: Use workspace.findFiles to get all source files
    try {
      const files = await vscode.workspace.findFiles(
        "**/*.{ts,tsx,js,jsx}",
        "**/node_modules/**",
        500 // Limit to 500 files for performance
      );

      // Process in chunks to avoid blocking event loop
      const CHUNK_SIZE = 10;
      for (let i = 0; i < files.length; i += CHUNK_SIZE) {
        const chunk = files.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (file) => {
            const fileFsPath = file.fsPath;
            if (fileFsPath === filePath) {
              return;
            }

            try {
              const content = await fs.promises.readFile(fileFsPath, "utf-8");

              // Check if this file imports our target file
              // Look for the filename or relative path in import statements
              const importRegex = new RegExp(
                `(?:import|require).*["'].*${fileName}.*["']`,
                "g"
              );

              if (importRegex.test(content)) {
                // Verify it's actually importing our file
                const imports = await this.parseImports(fileFsPath);
                if (imports.includes(filePath)) {
                  importers.add(fileFsPath);
                }
              }
            } catch (error) {
              // Ignore
            }
          })
        );

        // Yield to event loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.error("Error finding importers:", error);
    }

    return Array.from(importers);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.importCache.clear();
  }
}
