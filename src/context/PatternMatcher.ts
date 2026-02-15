import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Pattern matcher for workspace intelligence
 * Detects related files based on common project patterns
 */
export class PatternMatcher {
  /**
   * Get files related by common patterns
   */
  public async getRelatedFiles(filePath: string): Promise<string[]> {
    const relatedFiles = new Set<string>();

    // 1. Test file patterns
    const testFiles = await this.findTestFiles(filePath);
    testFiles.forEach((f) => relatedFiles.add(f));

    // 2. Related file patterns (types, styles, etc.)
    const relatedTypeFiles = await this.findRelatedTypeFiles(filePath);
    relatedTypeFiles.forEach((f) => relatedFiles.add(f));

    // 3. Feature folder pattern (files in same directory)
    const sameDirectoryFiles = await this.findSameDirectoryFiles(filePath);
    sameDirectoryFiles.forEach((f) => relatedFiles.add(f));

    // 4. Index file pattern
    const indexFiles = await this.findIndexFiles(filePath);
    indexFiles.forEach((f) => relatedFiles.add(f));

    return Array.from(relatedFiles);
  }

  /**
   * Find test files for the given source file
   * Patterns: *.test.ts, *.spec.ts, __tests__/*.ts
   */
  private async findTestFiles(filePath: string): Promise<string[]> {
    const testFiles: string[] = [];
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);

    // Pattern 1: same directory with .test or .spec
    const testPatterns = [
      path.join(dir, `${baseName}.test${ext}`),
      path.join(dir, `${baseName}.spec${ext}`),
      path.join(dir, `${baseName}.test.ts`),
      path.join(dir, `${baseName}.spec.ts`),
      path.join(dir, `${baseName}.test.tsx`),
      path.join(dir, `${baseName}.spec.tsx`),
    ];

    for (const pattern of testPatterns) {
      if (fs.existsSync(pattern)) {
        testFiles.push(pattern);
      }
    }

    // Pattern 2: __tests__ directory
    const testsDir = path.join(dir, "__tests__");
    if (fs.existsSync(testsDir)) {
      const testInTestsDir = [
        path.join(testsDir, `${baseName}.test${ext}`),
        path.join(testsDir, `${baseName}.spec${ext}`),
        path.join(testsDir, `${baseName}${ext}`),
      ];

      for (const pattern of testInTestsDir) {
        if (fs.existsSync(pattern)) {
          testFiles.push(pattern);
        }
      }
    }

    // Pattern 3: tests directory at parent level
    const parentDir = path.dirname(dir);
    const testsParentDir = path.join(parentDir, "tests");
    if (fs.existsSync(testsParentDir)) {
      const dirName = path.basename(dir);
      const testInParentTests = path.join(
        testsParentDir,
        dirName,
        `${baseName}.test${ext}`
      );
      if (fs.existsSync(testInParentTests)) {
        testFiles.push(testInParentTests);
      }
    }

    return testFiles;
  }

  /**
   * Find related type/style/config files
   * Patterns: *.types.ts, *.styles.css, *.config.ts, etc.
   */
  private async findRelatedTypeFiles(filePath: string): Promise<string[]> {
    const relatedFiles: string[] = [];
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));

    const relatedPatterns = [
      // Type files
      path.join(dir, `${baseName}.types.ts`),
      path.join(dir, `${baseName}.d.ts`),
      path.join(dir, `${baseName}.interface.ts`),
      // Style files
      path.join(dir, `${baseName}.styles.css`),
      path.join(dir, `${baseName}.styles.scss`),
      path.join(dir, `${baseName}.module.css`),
      path.join(dir, `${baseName}.css`),
      // Config files
      path.join(dir, `${baseName}.config.ts`),
      path.join(dir, `${baseName}.config.js`),
      // Hook files (for React components)
      path.join(dir, `use${baseName}.ts`),
      path.join(dir, `use${baseName}.tsx`),
    ];

    for (const pattern of relatedPatterns) {
      if (fs.existsSync(pattern)) {
        relatedFiles.push(pattern);
      }
    }

    // Also check hooks directory
    const parentDir = path.dirname(dir);
    const hooksDir = path.join(parentDir, "hooks");
    if (fs.existsSync(hooksDir)) {
      const hookFile = path.join(hooksDir, `use${baseName}.ts`);
      if (fs.existsSync(hookFile)) {
        relatedFiles.push(hookFile);
      }
    }

    return relatedFiles;
  }

  /**
   * Find files in the same directory (feature folder pattern)
   * Limit to avoid too many results
   */
  private async findSameDirectoryFiles(filePath: string): Promise<string[]> {
    const dir = path.dirname(filePath);
    const sameDirectoryFiles: string[] = [];

    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const entryPath = path.join(dir, entry);

        // Skip the current file
        if (entryPath === filePath) {
          continue;
        }

        // Only include files (not directories)
        const stat = fs.statSync(entryPath);
        if (stat.isFile()) {
          // Only include source files
          const ext = path.extname(entry);
          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
            sameDirectoryFiles.push(entryPath);
          }
        }
      }

      // Limit to 10 files to avoid overwhelming
      return sameDirectoryFiles.slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  /**
   * Find index files in parent directories
   */
  private async findIndexFiles(filePath: string): Promise<string[]> {
    const indexFiles: string[] = [];
    const dir = path.dirname(filePath);

    // Check for index file in same directory
    const indexPatterns = [
      path.join(dir, "index.ts"),
      path.join(dir, "index.tsx"),
      path.join(dir, "index.js"),
      path.join(dir, "index.jsx"),
    ];

    for (const pattern of indexPatterns) {
      if (fs.existsSync(pattern) && pattern !== filePath) {
        indexFiles.push(pattern);
      }
    }

    // Check parent directory index
    const parentDir = path.dirname(dir);
    const parentIndexPatterns = [
      path.join(parentDir, "index.ts"),
      path.join(parentDir, "index.tsx"),
      path.join(parentDir, "index.js"),
      path.join(parentDir, "index.jsx"),
    ];

    for (const pattern of parentIndexPatterns) {
      if (fs.existsSync(pattern)) {
        indexFiles.push(pattern);
      }
    }

    return indexFiles;
  }

  /**
   * Check if a file is a test file
   */
  public isTestFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return (
      fileName.includes(".test.") ||
      fileName.includes(".spec.") ||
      filePath.includes("__tests__") ||
      filePath.includes("/tests/")
    );
  }

  /**
   * Get the source file for a test file
   */
  public async getSourceFileForTest(
    testFilePath: string
  ): Promise<string | null> {
    if (!this.isTestFile(testFilePath)) {
      return null;
    }

    const dir = path.dirname(testFilePath);
    const baseName = path
      .basename(testFilePath)
      .replace(/\.(test|spec)\./, ".");

    // Try to find source file in same directory
    const sameDir = path.join(dir, baseName);
    if (fs.existsSync(sameDir)) {
      return sameDir;
    }

    // Try parent directory if in __tests__
    if (dir.endsWith("__tests__")) {
      const parentDir = path.dirname(dir);
      const parentFile = path.join(parentDir, baseName);
      if (fs.existsSync(parentFile)) {
        return parentFile;
      }
    }

    return null;
  }
}
