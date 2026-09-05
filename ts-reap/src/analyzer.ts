import { Project, SourceFile, Node } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

export interface UnusedFinding {
  filePath: string;
  name: string;
  kind: "export" | "local";
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  message: string;
}

export interface AnalyzerOptions {
  /** Absolute path to tsconfig.json */
  tsConfigFilePath: string;
  /** Glob patterns (relative to project root) treated as entry points. */
  entryPatterns?: string[];
  /** Extra skip patterns (in addition to .gitignore). */
  ignorePatterns?: string[];
  /** Files/folders to scan. If omitted, all files from tsconfig are scanned. */
  scopePaths?: string[];
}

export class ProjectAnalyzer {
  private project: Project;
  private options: AnalyzerOptions;

  constructor(options: AnalyzerOptions) {
    this.options = options;
    this.project = new Project({
      tsConfigFilePath: options.tsConfigFilePath,
      skipAddingFilesFromTsConfig: true,
    });

    const gitignorePatterns = readGitignorePatterns(this.getProjectRoot());
    this.options.ignorePatterns = [
      ...(options.ignorePatterns ?? [
        "node_modules",
        ".d.ts",
        "/dist/",
        "/build/",
      ]),
      ...gitignorePatterns,
    ];

    if (options.scopePaths && options.scopePaths.length > 0) {
      const globs = options.scopePaths.map((p) => this.toGlob(p));
      this.project.addSourceFilesAtPaths(globs);
    } else {
      this.project.addSourceFilesFromTsConfig(options.tsConfigFilePath);
    }
  }

  private getProjectRoot(): string {
    return path.dirname(this.options.tsConfigFilePath);
  }

  private toGlob(scopePath: string): string {
    const abs = path.isAbsolute(scopePath)
      ? scopePath
      : path.join(this.getProjectRoot(), scopePath);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      return path.join(abs, "**/*.{ts,tsx,js,jsx,d.ts}");
    }
    return abs;
  }

  updateFile(filePath: string, content: string): void {
    const existing = this.project.getSourceFile(filePath);
    if (existing) {
      existing.replaceWithText(content);
    } else {
      this.project.createSourceFile(filePath, content, { overwrite: true });
    }
  }

  refresh(): void {
    if (this.options.scopePaths && this.options.scopePaths.length > 0) {
      const globs = this.options.scopePaths.map((p) => this.toGlob(p));
      this.project.addSourceFilesAtPaths(globs);
    } else {
      this.project.addSourceFilesFromTsConfig(this.options.tsConfigFilePath);
    }
    for (const sf of this.project.getSourceFiles()) {
      sf.refreshFromFileSystemSync();
    }
  }

  private isIgnored(filePath: string): boolean {
    const rel = path
      .relative(this.getProjectRoot(), filePath)
      .split(path.sep)
      .join("/");
    const patterns = this.options.ignorePatterns ?? [];
    return patterns.some((p) => {
      const cleaned = p.replace(/^\/+|\/+$/g, "");
      if (!cleaned) return false;
      return (
        rel.includes(cleaned) ||
        filePath.includes(p) ||
        (cleaned.endsWith("*") && rel.startsWith(cleaned.slice(0, -1)))
      );
    });
  }

  private isInScope(sf: SourceFile): boolean {
    const scope = this.options.scopePaths;
    if (!scope || scope.length === 0) return true;
    const rel = path
      .relative(this.getProjectRoot(), sf.getFilePath())
      .split(path.sep)
      .join("/");
    return scope.some((p) => {
      const pRel = p.split(path.sep).join("/").replace(/\/+$/, "");
      return rel === pRel || rel.startsWith(pRel + "/");
    });
  }

  private isEntryFile(sf: SourceFile): boolean {
    const patterns = this.options.entryPatterns ?? [];
    const filePath = sf.getFilePath();
    return patterns.some((p) => filePath.includes(p));
  }

  private isReExportReference(node: Node): boolean {
    const parent = node.getParent();
    if (!parent) return false;

    if (Node.isExportDeclaration(parent)) {
      return parent.getModuleSpecifier() !== undefined;
    }

    if (Node.isExportSpecifier(parent)) {
      const exportDecl = parent.getParent()?.getParent();
      if (exportDecl && Node.isExportDeclaration(exportDecl)) {
        return exportDecl.getModuleSpecifier() !== undefined;
      }
    }

    return false;
  }

  findUnusedExports(): UnusedFinding[] {
    const findings: UnusedFinding[] = [];
    const sourceFiles = this.project
      .getSourceFiles()
      .filter((sf) => this.isInScope(sf))
      .filter((sf) => !this.isIgnored(sf.getFilePath()));

    for (const sf of sourceFiles) {
      if (this.isEntryFile(sf)) continue;

      const exportedDeclarations = sf.getExportedDeclarations();

      for (const [name, declarations] of exportedDeclarations) {
        for (const decl of declarations) {
          if (!Node.isReferenceFindable(decl)) continue;

          let references: Node[] = [];
          try {
            references = decl.findReferencesAsNodes();
          } catch {
            continue;
          }

          const realReferences = references.filter((ref) => {
            if (ref === decl) return false;
            if (this.isReExportReference(ref)) return false;
            return true;
          });

          if (realReferences.length === 0) {
            try {
              const start = decl.getStart();
              const end = decl.getEnd();
              const startPos = sf.getLineAndColumnAtPos(start);
              const endPos = sf.getLineAndColumnAtPos(end);

              findings.push({
                filePath: sf.getFilePath(),
                name,
                kind: "export",
                startLine: startPos.line - 1,
                startChar: startPos.column - 1,
                endLine: endPos.line - 1,
                endChar: endPos.column - 1,
                message: `Exported "${name}" is not used anywhere else in the project (re-exports excluded).`,
              });
            } catch {
              console.warn(`Warning: Could not get position for "${name}" in ${sf.getFilePath()}`);
              continue;
            }
          }
        }
      }
    }

    return findings;
  }

  findUnusedExportsForFile(filePath: string): UnusedFinding[] {
    return this.findUnusedExports().filter((f) => f.filePath === filePath);
  }

  findUnusedLocals(): UnusedFinding[] {
    const findings: UnusedFinding[] = [];
    const sourceFiles = this.project
      .getSourceFiles()
      .filter((sf) => this.isInScope(sf))
      .filter((sf) => !this.isIgnored(sf.getFilePath()));

    for (const sf of sourceFiles) {
      if (this.isEntryFile(sf)) continue;
      if (sf.getImportDeclarations().length > 0 || sf.getExportedDeclarations().size > 0) continue;

      for (const stmt of sf.getVariableStatements()) {
        if (stmt.getParent() !== sf) continue;

        for (const decl of stmt.getDeclarations()) {
          if (!Node.isReferenceFindable(decl)) continue;

          let references: Node[] = [];
          try {
            references = decl.findReferencesAsNodes();
          } catch {
            continue;
          }

          const realReferences = references.filter((ref) => ref !== decl);
          if (realReferences.length === 0) {
            try {
              const start = decl.getStart();
              const end = decl.getEnd();
              const startPos = sf.getLineAndColumnAtPos(start);
              const endPos = sf.getLineAndColumnAtPos(end);

              findings.push({
                filePath: sf.getFilePath(),
                name: decl.getName(),
                kind: "local",
                startLine: startPos.line - 1,
                startChar: startPos.column - 1,
                endLine: endPos.line - 1,
                endChar: endPos.column - 1,
                message: `Variable "${decl.getName()}" is declared but never used (script file, global scope).`,
              });
            } catch {
              console.warn(`Warning: Could not get position for "${decl.getName()}" in ${sf.getFilePath()}`);
              continue;
            }
          }
        }
      }
    }

    return findings;
  }

  dispose(): void {
    // ts-morph Project has no explicit dispose; drop the reference for GC.
  }
}

function readGitignorePatterns(projectRoot: string): string[] {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return [];
  const content = fs.readFileSync(gitignorePath, "utf-8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function normalizePath(p: string): string {
  return path.normalize(p).split(path.sep).join("/");
}