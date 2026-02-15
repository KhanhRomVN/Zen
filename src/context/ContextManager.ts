import { FileSystemAnalyzer } from "./FileSystemAnalyzer";
import { WorkspaceAnalyzer } from "./WorkspaceAnalyzer";
import { ContextBuilder } from "./ContextBuilder";
import { SmartContextProvider } from "./SmartContextProvider";

export class ContextManager {
  private fileSystemAnalyzer: FileSystemAnalyzer;
  private workspaceAnalyzer: WorkspaceAnalyzer;
  private contextBuilder: ContextBuilder;
  private smartContextProvider: SmartContextProvider;

  constructor() {
    this.fileSystemAnalyzer = new FileSystemAnalyzer();
    this.workspaceAnalyzer = new WorkspaceAnalyzer();
    this.contextBuilder = new ContextBuilder();
    this.smartContextProvider = new SmartContextProvider();
  }

  /**
   * Generate full context string cho một task
   */
  public async generateContext(
    task: string,
    isFirstRequest: boolean = false,
    projectContext: any = null,
  ): Promise<string> {
    const startTime = Date.now();

    // Lấy workspace info
    const workspaceInfo = await this.workspaceAnalyzer.getWorkspaceInfo();

    // Get folder paths (outside-in ordering) with counts
    const folderPaths = await this.fileSystemAnalyzer.getFolderPaths(5);

    // Get related files using smart context provider
    let relatedFilePaths: string[] = [];
    let relatedFilesLineCounts: Map<string, number> = new Map();

    if (isFirstRequest) {
      const scStart = Date.now();
      // Only get related files on first request to save tokens
      const relatedFiles = await this.smartContextProvider.getRelatedFilePaths({
        maxDepth: 2,
        maxResults: 30,
        minScore: 10,
        recencyBoost: true,
        sizeAwareness: true,
        directoryProximity: true,
      });

      // Convert absolute paths to relative paths
      relatedFilePaths =
        this.fileSystemAnalyzer.getRelativeFilePaths(relatedFiles);

      // Get line counts for related files
      for (const file of relatedFilePaths) {
        const count = await this.fileSystemAnalyzer.getFileLineCount(file);
        relatedFilesLineCounts.set(file, count);
      }
    }

    // Count total files
    const fileCount = await this.fileSystemAnalyzer.countFiles();

    // Get git history
    const gitHistory = await this.workspaceAnalyzer.getRecentGitChanges(10);
    const gitHistoryLineCounts: Map<string, number> = new Map();
    for (const file of gitHistory) {
      const count = await this.fileSystemAnalyzer.getFileLineCount(file);
      gitHistoryLineCounts.set(file, count);
    }

    // Get open tabs line counts
    const openTabsLineCounts: Map<string, number> = new Map();
    for (const file of workspaceInfo.openTabs) {
      const count = await this.fileSystemAnalyzer.getFileLineCount(file);
      openTabsLineCounts.set(file, count);
    }

    // Build context string with new format

    // Build context string with new format
    const context = this.contextBuilder.buildContextString(
      task,
      workspaceInfo,
      folderPaths,
      relatedFilePaths,
      relatedFilesLineCounts,
      gitHistory,
      gitHistoryLineCounts,
      openTabsLineCounts,
      fileCount,
      isFirstRequest,
      projectContext,
    );

    return context;
  }

  public setBlacklist(paths: string[]): void {
    this.fileSystemAnalyzer.setBlacklist(paths);
  }

  public async getRawFileTree(): Promise<any> {
    return this.fileSystemAnalyzer.getRawFileTree();
  }

  public getFileSystemAnalyzer(): FileSystemAnalyzer {
    return this.fileSystemAnalyzer;
  }

  /**
   * Clear caches for performance
   */
  public clearCache(): void {
    this.smartContextProvider.clearCache();
  }
}
