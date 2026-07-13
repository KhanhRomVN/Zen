import { getDefaultPrompt, combinePrompts, buildPermissionModeTag, CHECKPOINT_REMINDER, CHECKPOINT_INTERVAL } from "../prompts";
import { getShallowTree } from "../utils/messageParser";
import { extensionService } from "@/services/ExtensionService";

export interface PromptBuilderOptions {
  content: string;
  isReq1: boolean;
  skipFirstRequestLogic: boolean;
  aiLanguage: string;
  permissionMode: string;
  treeView: string;
  workspace: string;
  files?: any[];
  userRequestCount: number;
}

export class PromptBuilder {
  static async buildPrompt(options: PromptBuilderOptions): Promise<string> {
    const {
      content,
      isReq1,
      skipFirstRequestLogic,
      aiLanguage,
      permissionMode,
      treeView,
      workspace,
      files,
      userRequestCount,
    } = options;

    let systemPrompt = "";
    let projectContextStr = "";
    let attachedContextStr = "";

    // Build system prompt for first request
    if (isReq1) {
      systemPrompt = await this.buildSystemPrompt(
        aiLanguage,
        permissionMode,
        treeView,
        workspace,
      );
      projectContextStr = this.buildProjectContext(treeView, workspace);
    }

    // Build attached context
    if (files && files.length > 0) {
      attachedContextStr = await this.buildAttachedContext(files);
    }

    // Build full content
    const fullContent = skipFirstRequestLogic
      ? content
      : `## User Message\n<zen-user-content>\n${content}\n</zen-user-content>`;

    // Permission mode tag
    const permissionModeTag = buildPermissionModeTag(permissionMode);

    // Checkpoint reminder
    let checkpointReminder = "";
    if (!skipFirstRequestLogic && userRequestCount % CHECKPOINT_INTERVAL === 0) {
      checkpointReminder = `\n\n${CHECKPOINT_REMINDER}`;
    }

    // Combine all parts
    const promptPayload = isReq1
      ? `${systemPrompt}${projectContextStr}${attachedContextStr}\n\n${permissionModeTag}${checkpointReminder}\n\n${fullContent}`
      : `${attachedContextStr}\n\n${permissionModeTag}${checkpointReminder}\n\n${fullContent}`;

    return promptPayload;
  }

  private static async buildSystemPrompt(
    aiLanguage: string,
    permissionMode: string,
    treeView: string,
    workspace: string,
  ): Promise<string> {
    let systemInfo = {
      os: "Unknown OS",
      ide: "Zen IDE",
      shell: "unknown",
      homeDir: "~",
      cwd: ".",
      language: aiLanguage,
    };

    try {
      const fetchedInfo = await extensionService.getSystemInfo();
      if (fetchedInfo?.data) {
        systemInfo = {
          ...systemInfo,
          ...fetchedInfo.data,
          language: aiLanguage,
        };
      }
    } catch (e) {
      console.warn("[PromptBuilder] Failed to fetch system info:", e);
    }

    const effectiveLang = aiLanguage;
    let systemPrompt = getDefaultPrompt(effectiveLang);

    // Use real system info if we managed to fetch it
    if (systemInfo.os !== "Unknown OS") {
      systemPrompt = combinePrompts({
        language: effectiveLang,
        systemInfo,
        permissionMode,
      });
    }

    return systemPrompt;
  }

  private static buildProjectContext(treeView: string, workspace: string): string {
    let projectContextStr = "";

    if (treeView && treeView.trim()) {
      projectContextStr += `\n\n## Project Structure\n\`\`\`\n${getShallowTree(treeView)}\n\`\`\``;
    }
    if (workspace && workspace.trim()) {
      projectContextStr += `\n\n## WORKSPACE EXPERIENCE (workspace.md)\n\`\`\`\n${workspace}\n\`\`\``;
    }

    return projectContextStr;
  }

  private static async buildAttachedContext(files: any[]): Promise<string> {
    const attachedItems = files.filter(
      (f: any) =>
        f.id?.startsWith("attached-") ||
        f.id?.startsWith("rule-") ||
        f.id?.startsWith("terminal-"),
    );

    if (attachedItems.length === 0) return "";

    let attachedContextStr = "\n\n## Attached Context\n";

    const fileItems = attachedItems.filter((f: any) => f.type === "file");
    const folderItems = attachedItems.filter((f: any) => f.type === "folder");
    const terminalItems = attachedItems.filter((f: any) => f.type === "terminal");

    if (fileItems.length > 0) {
      attachedContextStr += "\n### Files\n";
      fileItems.forEach((f: any) => {
        attachedContextStr += `- ${f.path}\n`;
      });
    }

    if (folderItems.length > 0) {
      attachedContextStr += "\n### Folders (Tree Structure)\n";
      for (const f of folderItems) {
        const requestId = `folder-tree-${Date.now()}-${Math.random()}`;
        const treeData: any = await new Promise((resolve) => {
          const timeoutId = setTimeout(() => resolve(null), 3000);
          const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "getFolderTreeResult" &&
              msg.requestId === requestId
            ) {
              clearTimeout(timeoutId);
              window.removeEventListener("message", handler);
              resolve(msg.tree);
            }
          };
          window.addEventListener("message", handler);
          extensionService.postMessage({
            command: "getFolderTree",
            requestId,
            path: f.path,
          });
        });
        attachedContextStr += `#### ${f.path}\n\`\`\`\n${treeData || "Error fetching tree structure"}\n\`\`\`\n`;
      }
    }

    if (terminalItems.length > 0) {
      attachedContextStr += "\n### Terminals\n";
      terminalItems.forEach((f: any) => {
        attachedContextStr += `- terminal_id: ${f.path}\n`;
      });
    }

    return attachedContextStr;
  }
}
