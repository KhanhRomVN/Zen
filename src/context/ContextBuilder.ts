import { WorkspaceInfo } from "./WorkspaceAnalyzer";

export class ContextBuilder {
  public buildContextString(
    task: string,
    workspaceInfo: WorkspaceInfo,
    folderPaths: { path: string; count: number }[],
    gitHistory: string[],
    gitHistoryLineCounts: Map<string, number>,
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

    const context = `</task>${projectContextString}

<environment_details>${
      isFirstRequest
        ? `

# Current Working Directory (${workspaceInfo.path})

## Folder Structure
${this.formatFolderPaths(folderPaths)}

## Git History (Recently Modified)
${this.formatGitHistory(gitHistory, gitHistoryLineCounts)}

(Total files in workspace: ${fileCount})

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

  private formatFolderPaths(folderPaths: { path: string; count: number }[]): string {
    if (folderPaths.length === 0) return "No folders";
    return [...folderPaths]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((item) => {
        const parts = item.path.split("/");
        const depth = parts.length - 1;
        const name = parts[parts.length - 1];
        return `${"  ".repeat(depth)}${name}/(${item.count})`;
      })
      .join("\n");
  }

  private formatGitHistory(files: string[], lineCounts: Map<string, number>): string {
    if (files.length === 0) return "No git history available";
    return files.map((file) => `${file}(${lineCounts.get(file) || 0})`).join(" | ");
  }
}
