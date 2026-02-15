import * as vscode from "vscode";
import { RelatedFile } from "./types";

/**
 * LSP-based file discovery using VSCode's language services
 * Finds files related through code relationships (definitions, references, types, implementations)
 */
export class RelatedFilesAnalyzer {
  /**
   * Get files related to the current file via LSP
   */
  public async getRelatedFiles(
    document: vscode.TextDocument,
    position?: vscode.Position
  ): Promise<string[]> {
    const relatedFiles = new Set<string>();
    const currentFile = document.uri.fsPath;

    // Use first non-empty line if no position provided
    if (!position) {
      position = new vscode.Position(0, 0);
      for (let i = 0; i < Math.min(document.lineCount, 50); i++) {
        const line = document.lineAt(i);
        if (line.text.trim().length > 0) {
          position = new vscode.Position(i, 0);
          break;
        }
      }
    }

    try {
      // 1. Find definitions
      const definitions = await this.getDefinitions(document.uri, position);
      definitions.forEach((file) => {
        if (file !== currentFile) {
          relatedFiles.add(file);
        }
      });

      // 2. Find references
      const references = await this.getReferences(document.uri, position);
      references.forEach((file) => {
        if (file !== currentFile) {
          relatedFiles.add(file);
        }
      });

      // 3. Find type definitions
      const typeDefinitions = await this.getTypeDefinitions(
        document.uri,
        position
      );
      typeDefinitions.forEach((file) => {
        if (file !== currentFile) {
          relatedFiles.add(file);
        }
      });

      // 4. Find implementations
      const implementations = await this.getImplementations(
        document.uri,
        position
      );
      implementations.forEach((file) => {
        if (file !== currentFile) {
          relatedFiles.add(file);
        }
      });

      // Also scan through the entire document for more symbols
      await this.scanDocument(document, relatedFiles, currentFile);
    } catch (error) {
      console.error("❌ Error in LSP analysis:", error);
    }

    const result = Array.from(relatedFiles);
    return result;
  }

  /**
   * Scan entire document for symbols and get their related files
   */
  private async scanDocument(
    document: vscode.TextDocument,
    relatedFiles: Set<string>,
    currentFile: string
  ): Promise<void> {
    // Optimization: Limit sampling to avoid blocking extension host
    // Instead of lineCount / 20, we use a fixed maximum of 5 samples
    const MAX_SAMPLES = 5;
    const samplePositions: vscode.Position[] = [];

    // Calculate step to cover the file evenly with MAX_SAMPLES
    const step = Math.max(1, Math.floor(document.lineCount / MAX_SAMPLES));

    for (
      let i = 0;
      i < document.lineCount && samplePositions.length < MAX_SAMPLES;
      i += step
    ) {
      const line = document.lineAt(i);
      // Only sample lines with substantial content (length > 20) to avoid importing from empty lines or brackets
      if (line.text.trim().length > 20) {
        samplePositions.push(new vscode.Position(i, 0));
      }
    }

    // Get definitions and type definitions for sampled positions
    // Run sequentially to be gentle on the LSP
    for (const pos of samplePositions) {
      try {
        // Run these in parallel for the single position
        const [defs, typeDefs] = await Promise.all([
          this.getDefinitions(document.uri, pos),
          this.getTypeDefinitions(document.uri, pos),
        ]);

        defs.forEach((file) => {
          if (file !== currentFile) {
            relatedFiles.add(file);
          }
        });

        typeDefs.forEach((file) => {
          if (file !== currentFile) {
            relatedFiles.add(file);
          }
        });

        // Small delay to yield to event loop
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch (error) {
        // Skip errors for individual positions
        continue;
      }
    }
  }

  /**
   * Get definition locations
   */
  private async getDefinitions(
    uri: vscode.Uri,
    position: vscode.Position
  ): Promise<string[]> {
    try {
      const locations = (await vscode.commands.executeCommand(
        "vscode.executeDefinitionProvider",
        uri,
        position
      )) as vscode.Location[] | vscode.LocationLink[];

      if (!locations) {
        return [];
      }

      return this.extractFilePaths(locations);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get reference locations
   */
  private async getReferences(
    uri: vscode.Uri,
    position: vscode.Position
  ): Promise<string[]> {
    try {
      const locations = (await vscode.commands.executeCommand(
        "vscode.executeReferenceProvider",
        uri,
        position
      )) as vscode.Location[];

      if (!locations) {
        return [];
      }

      return this.extractFilePaths(locations);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get type definition locations
   */
  private async getTypeDefinitions(
    uri: vscode.Uri,
    position: vscode.Position
  ): Promise<string[]> {
    try {
      const locations = (await vscode.commands.executeCommand(
        "vscode.executeTypeDefinitionProvider",
        uri,
        position
      )) as vscode.Location[] | vscode.LocationLink[];

      if (!locations) {
        return [];
      }

      return this.extractFilePaths(locations);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get implementation locations
   */
  private async getImplementations(
    uri: vscode.Uri,
    position: vscode.Position
  ): Promise<string[]> {
    try {
      const locations = (await vscode.commands.executeCommand(
        "vscode.executeImplementationProvider",
        uri,
        position
      )) as vscode.Location[] | vscode.LocationLink[];

      if (!locations) {
        return [];
      }

      return this.extractFilePaths(locations);
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract unique file paths from locations
   */
  private extractFilePaths(
    locations: vscode.Location[] | vscode.LocationLink[]
  ): string[] {
    const files = new Set<string>();

    for (const location of locations) {
      if ("uri" in location) {
        // vscode.Location
        files.add(location.uri.fsPath);
      } else if ("targetUri" in location) {
        // vscode.LocationLink
        files.add(location.targetUri.fsPath);
      }
    }

    return Array.from(files);
  }
}
