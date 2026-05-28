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

  public async generateContext(
    task: string,
    isFirstRequest: boolean = false,
    projectContext: any = null,
  ): Promise<string> {
    const workspaceInfo = await this.workspaceAnalyzer.getWorkspaceInfo();
    const folderPaths = await this.fileSystemAnalyzer.getFolderPaths(5);
    const fileCount = await this.fileSystemAnalyzer.countFiles();
    const gitHistory = await this.workspaceAnalyzer.getRecentGitChanges(10);

    const gitHistoryLineCounts: Map<string, number> = new Map();
    for (const file of gitHistory) {
      const count = await this.fileSystemAnalyzer.getFileLineCount(file);
      gitHistoryLineCounts.set(file, count);
    }

    return this.contextBuilder.buildContextString(
      task,
      workspaceInfo,
      folderPaths,
      gitHistory,
      gitHistoryLineCounts,
      fileCount,
      isFirstRequest,
      projectContext,
    );
  }

  public setBlacklist(_paths: string[]): void {}

  public async getRawFileTree(): Promise<any> {
    return this.fileSystemAnalyzer.getRawFileTree();
  }

  public getFileSystemAnalyzer(): FileSystemAnalyzer {
    return this.fileSystemAnalyzer;
  }

  public clearCache(): void {}
}
