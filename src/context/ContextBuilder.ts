import * as vscode from "vscode";
import { WorkspaceInfo } from "./WorkspaceAnalyzer";

export class ContextBuilder {
  /**
   * Build context string theo format mong muốn
   */
  public buildContextString(
    task: string,
    workspaceInfo: WorkspaceInfo,
    fileTree: string,
    fileCount: number
  ): string {
    const context = `<task>
${task}
</task>


# task_progress RECOMMENDED

When starting a new task, it is recommended to include a todo list using the task_progress parameter.


1. Include a todo list using the task_progress parameter in your next tool call
2. Create a comprehensive checklist of all steps needed
3. Use markdown format: - [ ] for incomplete, - [x] for complete

**Benefits of creating a todo/task_progress list now:**
\t- Clear roadmap for implementation
\t- Progress tracking throughout the task
\t- Nothing gets forgotten or missed
\t- Users can see, monitor, and edit the plan

**Example structure:**\`\`\`
- [ ] Analyze requirements
- [ ] Set up necessary files
- [ ] Implement main functionality
- [ ] Handle edge cases
- [ ] Test the implementation
- [ ] Verify results\`\`\`

Keeping the task_progress list updated helps track progress and ensures nothing is missed.


<environment_details>
# Visual Studio Code Visible Files
${this.formatVisibleFiles(workspaceInfo.visibleFiles)}

# Visual Studio Code Open Tabs
${this.formatOpenTabs(workspaceInfo.openTabs)}

# Current Time
${this.formatCurrentTime()}

# Current Working Directory (${workspaceInfo.path}) Files
${fileTree}

(File list truncated. Total: ${fileCount} files)

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
}

# Context Window Usage
0 / 128K tokens used (0%)

</environment_details>`;

    return context;
  }

  /**
   * Format visible files section
   */
  private formatVisibleFiles(visibleFiles: string[]): string {
    if (visibleFiles.length === 0) {
      return "No visible files";
    }
    return visibleFiles.join("\n");
  }

  /**
   * Format open tabs section
   */
  private formatOpenTabs(openTabs: string[]): string {
    if (openTabs.length === 0) {
      return "No open tabs";
    }
    return openTabs.join("\n");
  }

  /**
   * Format current time with timezone
   */
  private formatCurrentTime(): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });

    return formatter.format(now);
  }
}
