import { FileSystemAnalyzer } from "./FileSystemAnalyzer";
import { WorkspaceAnalyzer } from "./WorkspaceAnalyzer";
import { ContextBuilder } from "./ContextBuilder";

export class ContextManager {
  private fileSystemAnalyzer: FileSystemAnalyzer;
  private workspaceAnalyzer: WorkspaceAnalyzer;
  private contextBuilder: ContextBuilder;

  constructor() {
    this.fileSystemAnalyzer = new FileSystemAnalyzer();
    this.workspaceAnalyzer = new WorkspaceAnalyzer();
    this.contextBuilder = new ContextBuilder();
  }

  /**
   * Generate full context string cho một task
   */
  public async generateContext(task: string): Promise<string> {
    // Lấy workspace info
    const workspaceInfo = await this.workspaceAnalyzer.getWorkspaceInfo();

    // Lấy file tree (max depth = 3)
    const fileTree = await this.fileSystemAnalyzer.getFileTree(3);

    // Count total files
    const fileCount = await this.fileSystemAnalyzer.countFiles();

    // Build context string
    const context = this.contextBuilder.buildContextString(
      task,
      workspaceInfo,
      fileTree,
      fileCount
    );

    return context;
  }
}
