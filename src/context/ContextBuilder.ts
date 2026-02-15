import * as vscode from "vscode";
import { WorkspaceInfo } from "./WorkspaceAnalyzer";

export class ContextBuilder {
  /**
   * Build context string theo format mới (2 phần: folders + files)
   */
  public buildContextString(
    task: string,
    workspaceInfo: WorkspaceInfo,
    folderPaths: { path: string; count: number }[],
    relatedFilePaths: string[],
    relatedFilesLineCounts: Map<string, number>,
    gitHistory: string[],
    gitHistoryLineCounts: Map<string, number>,
    openTabsLineCounts: Map<string, number>,
    fileCount: number,
    isFirstRequest: boolean,
    projectContext: any = null,
  ): string {
    let projectContextString = "";
    if (projectContext) {
      projectContextString = `
<project_context>
Name: ${projectContext.projectName}
Language: ${projectContext.language}
Description:
${projectContext.description}

Key Files:
${projectContext.keyFiles}
</project_context>
`;
    }

    const context = `</task>${projectContextString}${
      isFirstRequest
        ? `

# task_progress RECOMMENDED

When starting a new task, it is recommended to include a todo list using the task_progress tag.


1. Include a todo list using the task_progress independent xml tag (NOT inside tool parameters) in your next tool call

2. Create a comprehensive checklist of all steps needed
3. Use markdown format: - [ ] for incomplete, - [x] for complete

**Benefits of creating a todo/task_progress list now:**
	- Clear roadmap for implementation
	- Progress tracking throughout the task
	- Nothing gets forgotten or missed
	- Users can see, monitor, and edit the plan

**Example structure:**
\`\`\`
<task_progress>
- [ ] Analyze requirements
- [ ] Set up necessary files
- [ ] Implement main functionality
- [ ] Handle edge cases
- [ ] Test the implementation
- [ ] Verify results
</task_progress>
\`\`\`

Keeping the task_progress list updated helps track progress and ensures nothing is missed.`
        : ""
    }

<environment_details>
# Visual Studio Code Open Tabs
${this.formatOpenTabs(workspaceInfo.openTabs, openTabsLineCounts)}${
      isFirstRequest
        ? `

# Current Working Directory (${workspaceInfo.path})

## Folder Structure
## Folder Structure
${this.formatFolderPaths(folderPaths)}

## Related Files
${this.formatFilePaths(relatedFilePaths, relatedFilesLineCounts)}

## Git History (Recently Modified)
${this.formatGitHistory(gitHistory, gitHistoryLineCounts)}

(Total files in workspace: ${fileCount})`
        : ""
    }${
      isFirstRequest
        ? `

# Workspace Configuration
{
  "workspaces": {
    "${workspaceInfo.path}": {
      "hint": "${workspaceInfo.name}",
      "associatedRemoteUrls": [
        ${workspaceInfo.gitRemote ? `"origin: ${workspaceInfo.gitRemote}"` : ""}
      ]${
        workspaceInfo.gitBranch
          ? `,
      "currentBranch": "${workspaceInfo.gitBranch}"`
          : ""
      }
    }
  }
}`
        : ""
    }
</environment_details>`;

    return context;
  }

  /**
   * Format folder paths section (Tree View)
   */
  private formatFolderPaths(
    folderPaths: { path: string; count: number }[],
  ): string {
    if (folderPaths.length === 0) {
      return "No folders";
    }

    // Sort alphabetically to ensure tree order (DFS-like)
    const sortedPaths = [...folderPaths].sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    return sortedPaths
      .map((item) => {
        const parts = item.path.split("/");
        const depth = parts.length - 1;
        const name = parts[parts.length - 1];
        const indent = "  ".repeat(depth);
        return `${indent}${name}/(${item.count})`;
      })
      .join("\n");
  }

  /**
   * Format file paths section (Horizontal)
   */
  private formatFilePaths(
    filePaths: string[],
    lineCounts: Map<string, number>,
  ): string {
    if (filePaths.length === 0) {
      return "No related files found";
    }
    // Horizontal format: file(lines) | file2(lines)
    return filePaths
      .map((file) => {
        const lines = lineCounts.get(file) || 0;
        return `${file}(${lines})`;
      })
      .join(" | ");
  }

  /**
   * Format git history (Horizontal)
   */
  private formatGitHistory(
    files: string[],
    lineCounts: Map<string, number>,
  ): string {
    if (files.length === 0) {
      return "No git history available";
    }
    // Horizontal format: file(lines) | file2(lines)
    return files
      .map((file) => {
        const lines = lineCounts.get(file) || 0;
        return `${file}(${lines})`;
      })
      .join(" | ");
  }

  /**
   * Format open tabs section
   */
  private formatOpenTabs(
    openTabs: string[],
    lineCounts: Map<string, number>,
  ): string {
    if (openTabs.length === 0) {
      return "No open tabs";
    }
    return openTabs
      .map((file) => {
        const lines = lineCounts.get(file) || 0;
        return `${file}(${lines})`;
      })
      .join(" | ");
  }
}
