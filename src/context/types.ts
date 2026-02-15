/**
 * Shared types for Progressive Context Discovery System
 */

export interface RelatedFile {
  path: string; // Absolute path
  score: number; // 0-100
  reason: string[]; // ["LSP Reference", "Git Co-occurrence"]
  confidence: "high" | "medium" | "low";
  metadata: {
    lastModified: Date;
    size: number;
    dependencies: string[]; // Files this imports
    dependents: string[]; // Files that import this
    gitFrequency: number; // Number of times modified together with current file
  };
}

export interface AnalyzerResult {
  files: string[]; // Absolute paths
  weight: number; // Weight for scoring
}

export interface AnalyzerConfig {
  maxDepth?: number; // For import graph
  maxResults?: number; // Maximum files to return
  minScore?: number; // Minimum score threshold
  recencyBoost?: boolean; // Apply recency multiplier
  sizeAwareness?: boolean; // Apply size penalty
  directoryProximity?: boolean; // Boost same-directory files
}

export interface GitCooccurrence {
  filePath: string;
  frequency: number; // Number of times modified together
  lastModified: Date;
}

export interface ImportNode {
  path: string;
  imports: string[]; // Files this imports
  importedBy: string[]; // Files that import this
  depth: number; // Depth in dependency tree
}
