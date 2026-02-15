import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { GitCooccurrence } from "./types";

const execAsync = promisify(exec);

/**
 * Git history analyzer for detecting file co-occurrence patterns
 * Finds files that are frequently modified together
 */
export class GitHistoryAnalyzer {
  private cooccurrenceCache = new Map<string, GitCooccurrence[]>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  /**
   * Get files that are frequently modified together with the target file
   */
  public async getCooccurringFiles(
    filePath: string,
    options: {
      commitLimit?: number;
      minOccurrences?: number;
      recencyWeight?: boolean;
    } = {}
  ): Promise<string[]> {
    const {
      commitLimit = 150,
      minOccurrences = 3,
      recencyWeight = true,
    } = options;

    // Check cache
    const cached = this.getCached(filePath);
    if (cached) {
      return cached
        .filter((item) => item.frequency >= minOccurrences)
        .map((item) => item.filePath);
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const relativePath = path.relative(rootPath, filePath);

    try {
      // First check if this is a git repo
      try {
        await execAsync("git rev-parse --is-inside-work-tree", {
          cwd: rootPath,
        });
      } catch (e) {
        // Not a git repo, return empty without error
        return [];
      }

      // MAJOR OPTIMIZATION: Get everything in ONE command instead of 300+ spawned processes
      // git log --name-only format:
      // commit_hash commit_date
      //
      // file1
      // file2 ...
      const { stdout } = await execAsync(
        `git log -n ${commitLimit} --name-only --format="COMMIT:%H:%ci" -- "${relativePath}"`,
        { cwd: rootPath, maxBuffer: 1024 * 1024 * 10 }
      );

      if (!stdout.trim()) {
        return [];
      }

      const lines = stdout.split("\n");
      const cooccurrenceMap = new Map<string, GitCooccurrence>();
      let currentDate: Date | null = null;
      let currentCommitHash = "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("COMMIT:")) {
          // Parse commit header: COMMIT:hash:date
          const parts = trimmed.split(":");
          if (parts.length >= 3) {
            currentCommitHash = parts[1];
            // Reassemble date part (it might contain colons)
            const dateStr = parts.slice(2).join(":");
            currentDate = new Date(dateStr);
          }
        } else {
          // It's a file path
          if (!currentDate) continue;

          const absolutePath = path.join(rootPath, trimmed);

          // Skip the target file itself
          if (absolutePath === filePath) {
            continue;
          }

          if (!cooccurrenceMap.has(absolutePath)) {
            cooccurrenceMap.set(absolutePath, {
              filePath: absolutePath,
              frequency: 0,
              lastModified: currentDate,
            });
          }

          const item = cooccurrenceMap.get(absolutePath)!;

          // Apply recency weight
          let weight = 1;
          if (recencyWeight) {
            weight = this.calculateRecencyWeight(currentDate);
          }

          item.frequency += weight;

          // Update last modified if more recent
          if (currentDate > item.lastModified) {
            item.lastModified = currentDate;
          }
        }
      }

      // Convert to array and sort by frequency
      const cooccurrences = Array.from(cooccurrenceMap.values()).sort(
        (a, b) => b.frequency - a.frequency
      );

      // Cache results
      this.setCached(filePath, cooccurrences);

      // Filter by minimum occurrences and return paths
      return cooccurrences
        .filter((item) => item.frequency >= minOccurrences)
        .map((item) => item.filePath);
    } catch (error) {
      console.error("Error analyzing git history:", error);
      return [];
    }
  }

  /**
   * Calculate recency weight for a commit date
   * Recent commits get higher weight
   */
  private calculateRecencyWeight(commitDate: Date): number {
    const now = new Date();
    const daysDiff =
      (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 30) {
      return 1.0; // Last 30 days
    } else if (daysDiff <= 90) {
      return 0.7; // 30-90 days
    } else if (daysDiff <= 180) {
      return 0.4; // 90-180 days
    } else {
      return 0.2; // Older
    }
  }

  /**
   * Get cached results if available and not expired
   */
  private getCached(filePath: string): GitCooccurrence[] | null {
    const timestamp = this.cacheTimestamps.get(filePath);
    if (!timestamp) {
      return null;
    }

    const now = Date.now();
    if (now - timestamp > this.cacheExpiry) {
      // Cache expired
      this.cooccurrenceCache.delete(filePath);
      this.cacheTimestamps.delete(filePath);
      return null;
    }

    return this.cooccurrenceCache.get(filePath) || null;
  }

  /**
   * Set cached results
   */
  private setCached(filePath: string, results: GitCooccurrence[]): void {
    this.cooccurrenceCache.set(filePath, results);
    this.cacheTimestamps.set(filePath, Date.now());
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cooccurrenceCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Check if git is available in workspace
   */
  public async isGitAvailable(): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return false;
    }

    try {
      await execAsync("git --version", {
        cwd: workspaceFolders[0].uri.fsPath,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
