import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { RelatedFile, AnalyzerConfig } from "./types";
import { RelatedFilesAnalyzer } from "./RelatedFilesAnalyzer";
import { ImportGraphAnalyzer } from "./ImportGraphAnalyzer";
import { GitHistoryAnalyzer } from "./GitHistoryAnalyzer";
import { PatternMatcher } from "./PatternMatcher";

/**
 * Smart context provider - orchestrates all analyzers
 * Combines LSP, import graph, git history, and pattern matching
 */
export class SmartContextProvider {
  private lspAnalyzer: RelatedFilesAnalyzer;
  private importAnalyzer: ImportGraphAnalyzer;
  private gitAnalyzer: GitHistoryAnalyzer;
  private patternMatcher: PatternMatcher;

  // Weights for scoring
  private readonly LSP_WEIGHT = 50;
  private readonly IMPORT_WEIGHT = 30;
  private readonly GIT_WEIGHT = 15;
  private readonly PATTERN_WEIGHT = 5;

  constructor() {
    this.lspAnalyzer = new RelatedFilesAnalyzer();
    this.importAnalyzer = new ImportGraphAnalyzer();
    this.gitAnalyzer = new GitHistoryAnalyzer();
    this.patternMatcher = new PatternMatcher();
  }

  /**
   * Get related files for the active editor
   */
  public async getRelatedFiles(
    config: AnalyzerConfig = {}
  ): Promise<RelatedFile[]> {
    let editor = vscode.window.activeTextEditor;

    // Fallback: If no active editor (e.g., focus is on webview), try to get document from tabs
    if (!editor) {
      const document = await this.getDocumentFromTabs();

      if (document) {
        return this.getRelatedFilesForDocument(document, config);
      } else {
        return [];
      }
    }

    return this.getRelatedFilesForDocument(editor.document, config);
  }

  /**
   * Get a suitable document from open tabs
   */
  private async getDocumentFromTabs(): Promise<vscode.TextDocument | null> {
    const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

    // Filter for file tabs with source code
    const sourceTabs = allTabs.filter((tab) => {
      if (!tab.input || typeof tab.input !== "object") {
        return false;
      }

      const input = tab.input as any;
      if (!input.uri) {
        return false;
      }

      const uri = input.uri as vscode.Uri;

      // Only file scheme
      if (uri.scheme !== "file") {
        return false;
      }

      // Exclude output panels
      if (uri.fsPath.includes("extension-output")) {
        return false;
      }

      return true;
    });

    if (sourceTabs.length === 0) {
      return null;
    }

    // Get the first source tab's URI
    const firstTab = sourceTabs[0];
    const uri = (firstTab.input as any).uri as vscode.Uri;

    // Open the document
    try {
      const document = await vscode.workspace.openTextDocument(uri);

      // Check if it's a source code language
      const sourceLanguages = [
        "typescript",
        "javascript",
        "typescriptreact",
        "javascriptreact",
        "python",
        "java",
        "go",
        "rust",
        "cpp",
        "c",
      ];
      if (!sourceLanguages.includes(document.languageId)) {
        return null;
      }

      return document;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get related files for a specific document
   */
  public async getRelatedFilesForDocument(
    document: vscode.TextDocument,
    config: AnalyzerConfig = {}
  ): Promise<RelatedFile[]> {
    const {
      maxDepth = 2,
      maxResults = 30,
      minScore = 10,
      recencyBoost = true,
      sizeAwareness = true,
      directoryProximity = true,
    } = config;

    const currentFile = document.uri.fsPath;

    // Run all analyzers in parallel with a timeout
    const TIMEOUT_MS = 5000; // 5 seconds timeout for context generation

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<
      [string[], string[], string[], string[]]
    >((_, reject) => {
      setTimeout(
        () => reject(new Error("Context analysis timed out")),
        TIMEOUT_MS
      );
    });

    const MeasurePromise = async <T>(
      name: string,
      promise: Promise<T>
    ): Promise<T> => {
      const start = Date.now();
      try {
        const res = await promise;
        return res;
      } catch (e) {
        throw e;
      }
    };

    const analysisPromise = Promise.all([
      MeasurePromise("LSP", this.lspAnalyzer.getRelatedFiles(document)),
      MeasurePromise(
        "Import",
        this.importAnalyzer.getRelatedFiles(currentFile, maxDepth)
      ),
      MeasurePromise(
        "Git",
        this.gitAnalyzer.getCooccurringFiles(currentFile, {
          commitLimit: 150,
          minOccurrences: 2,
          recencyWeight: recencyBoost,
        })
      ),
      MeasurePromise(
        "Pattern",
        this.patternMatcher.getRelatedFiles(currentFile)
      ),
    ]);

    let lspFiles: string[] = [],
      importFiles: string[] = [],
      gitFiles: string[] = [],
      patternFiles: string[] = [];

    try {
      // Race against timeout
      [lspFiles, importFiles, gitFiles, patternFiles] = await Promise.race([
        analysisPromise,
        timeoutPromise,
      ]);
    } catch (error) {
      console.warn(
        "SmartContext analysis timed out or failed, using partial/empty results"
      );
      // In case of timeout or error, we continue with whatever empty results we have
      // or potentially whatever finished if we restructured to settleAll (but race is simpler for now)
    }

    // Combine results with scoring
    const fileScores = new Map<string, RelatedFile>();

    // Process LSP files
    lspFiles.forEach((file) => {
      this.addOrUpdateScore(fileScores, file, this.LSP_WEIGHT, "LSP Reference");
    });

    // Process import files
    importFiles.forEach((file) => {
      this.addOrUpdateScore(
        fileScores,
        file,
        this.IMPORT_WEIGHT,
        "Import Dependency"
      );
    });

    // Process git files
    gitFiles.forEach((file) => {
      this.addOrUpdateScore(
        fileScores,
        file,
        this.GIT_WEIGHT,
        "Git Co-occurrence"
      );
    });

    // Process pattern files
    patternFiles.forEach((file) => {
      this.addOrUpdateScore(
        fileScores,
        file,
        this.PATTERN_WEIGHT,
        "Pattern Match"
      );
    });

    // Apply additional scoring factors
    const results = Array.from(fileScores.values());

    for (const result of results) {
      // Recency multiplier
      if (recencyBoost) {
        const recencyMultiplier = this.calculateRecencyMultiplier(
          result.metadata.lastModified
        );
        result.score *= recencyMultiplier;
      }

      // Size penalty
      if (sizeAwareness) {
        const sizePenalty = this.calculateSizePenalty(result.metadata.size);
        result.score *= sizePenalty;
      }

      // Directory proximity bonus
      if (directoryProximity) {
        const proximityBonus = this.calculateProximityBonus(
          currentFile,
          result.path
        );
        result.score += proximityBonus;
      }

      // Set confidence level
      result.confidence = this.calculateConfidence(result.score);
    }

    // Sort by score and filter
    const filtered = results
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return filtered;
  }

  /**
   * Add or update file score
   */
  private addOrUpdateScore(
    fileScores: Map<string, RelatedFile>,
    filePath: string,
    weight: number,
    reason: string
  ): void {
    if (!fs.existsSync(filePath)) {
      return;
    }

    let relatedFile = fileScores.get(filePath);

    if (!relatedFile) {
      // Create new entry
      const stats = fs.statSync(filePath);
      relatedFile = {
        path: filePath,
        score: 0,
        reason: [],
        confidence: "low",
        metadata: {
          lastModified: stats.mtime,
          size: stats.size,
          dependencies: [],
          dependents: [],
          gitFrequency: 0,
        },
      };
      fileScores.set(filePath, relatedFile);
    }

    // Add score and reason
    relatedFile.score += weight;
    if (!relatedFile.reason.includes(reason)) {
      relatedFile.reason.push(reason);
    }
  }

  /**
   * Calculate recency multiplier based on last modified date
   */
  private calculateRecencyMultiplier(lastModified: Date): number {
    const now = new Date();
    const daysDiff =
      (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 7) {
      return 1.2; // Modified last 7 days
    } else if (daysDiff <= 30) {
      return 1.0; // Modified last 30 days
    } else if (daysDiff <= 90) {
      return 0.8; // Modified last 90 days
    } else {
      return 0.6; // Older
    }
  }

  /**
   * Calculate size penalty
   * Smaller files are generally more relevant
   */
  private calculateSizePenalty(sizeBytes: number): number {
    const lines = sizeBytes / 50; // Rough estimate: 50 bytes per line

    if (lines < 300) {
      return 1.0;
    } else if (lines < 1000) {
      return 0.9;
    } else if (lines < 3000) {
      return 0.7;
    } else {
      return 0.5; // Very large files
    }
  }

  /**
   * Calculate proximity bonus for files in same directory
   */
  private calculateProximityBonus(
    currentFile: string,
    targetFile: string
  ): number {
    const currentDir = path.dirname(currentFile);
    const targetDir = path.dirname(targetFile);

    if (currentDir === targetDir) {
      return 20; // Same directory
    }

    const currentParent = path.dirname(currentDir);
    const targetParent = path.dirname(targetDir);

    if (currentParent === targetParent) {
      return 10; // Same parent directory
    }

    return 0;
  }

  /**
   * Calculate confidence level based on score
   */
  private calculateConfidence(score: number): "high" | "medium" | "low" {
    if (score >= 70) {
      return "high";
    } else if (score >= 40) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Get only file paths (for simple use cases)
   */
  public async getRelatedFilePaths(
    config: AnalyzerConfig = {}
  ): Promise<string[]> {
    const relatedFiles = await this.getRelatedFiles(config);
    return relatedFiles.map((f) => f.path);
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.importAnalyzer.clearCache();
    this.gitAnalyzer.clearCache();
  }
}
