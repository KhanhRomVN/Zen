import {
  getDefaultPrompt,
  combinePrompts,
  combinePromptsForMode,
} from "../prompts";
import type { SystemPromptMode } from "../prompts";
import { extensionService } from "@/services/ExtensionService";

export interface PromptBuilderOptions {
  content: string;
  isReq1: boolean;
  skipFirstRequestLogic: boolean;
  aiLanguage: string;
  permissionMode: string;
  treeView: string;
  files?: any[];
  userRequestCount: number;
  systemPromptMode?: SystemPromptMode;
}

export const getShallowTree = (tree: string): string => {
  const lines = tree.split("\n");
  const result: string[] = [];
  let currentFolder: string | null = null;
  let fileCount = 0;

  const flush = () => {
    if (currentFolder !== null) {
      result.push(`${currentFolder} (${fileCount} files)`);
      currentFolder = null;
      fileCount = 0;
    }
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    const isTopLevel = !/^ /.test(line);
    if (isTopLevel) {
      flush();
      if (line.trimEnd().endsWith("/")) {
        currentFolder = line.trimEnd();
      } else {
        result.push(line);
      }
    } else if (currentFolder !== null) {
      if (!line.trimEnd().endsWith("/")) fileCount++;
    }
  }
  flush();
  return result.join("\n");
};

export class PromptBuilder {
  static async buildPrompt(options: PromptBuilderOptions): Promise<string> {
    const {
      content,
      isReq1,
      skipFirstRequestLogic,
      aiLanguage,
      permissionMode,
      treeView,
      files,
      userRequestCount,
      systemPromptMode,
    } = options;

    let systemPrompt = "";
    let attachedContextStr = "";

    // Build system prompt for first request
    if (isReq1) {
      systemPrompt = await this.buildSystemPrompt(
        aiLanguage,
        permissionMode,
        treeView,
        systemPromptMode,
      );
    }

    // Build attached context
    if (files && files.length > 0) {
      attachedContextStr = await this.buildAttachedContext(files);
    }

    // Build full content
    // Skip wrapping for tool execution results (they start with "Output:" or "[tool_name for '...'] Result:")
    const trimmedContent = content.trim();
    const isToolResult =
      trimmedContent.startsWith("Output:") ||
      /^\[.+?\] Result:/.test(trimmedContent); // Match any tool result format: [tool_name ...] Result:
    const fullContent =
      skipFirstRequestLogic || isToolResult
        ? content
        : `## User Message\n<user-message>\n${content}\n</user-message>`;

    // 🔧 Detect malformed tool errors in content and add XML syntax reminder
    // Only add when skipFirstRequestLogic=true (tool results, not wrapped in user-message)
    let xmlSyntaxReminder = "";
    const hasMalformedError =
      content.includes("MISSING_PARAMS") ||
      content.includes("INVALID_XML") ||
      content.includes("MALFORMED_TOOL") ||
      content.includes("PARSE_ERROR");

    // Combine all parts
    const promptPayload = isReq1
      ? `${systemPrompt}${attachedContextStr}${xmlSyntaxReminder}\n\n${fullContent}`
      : `${attachedContextStr}${xmlSyntaxReminder}\n\n${fullContent}`;

    return promptPayload.trim();
  }

  private static async buildSystemPrompt(
    aiLanguage: string,
    permissionMode: string,
    treeView: string,
    systemPromptMode?: SystemPromptMode,
  ): Promise<string> {
    let systemInfo = {
      os: "Unknown OS",
      ide: "Zen IDE",
      shell: "unknown",
      homeDir: "~",
      cwd: ".",
      language: aiLanguage,
      maxFilesPerSession: 3,
    };

    try {
      const fetchedInfo = await extensionService.getSystemInfo();
      if (fetchedInfo?.data) {
        systemInfo = {
          ...systemInfo,
          ...fetchedInfo.data,
          language: aiLanguage,
          maxFilesPerSession: 3,
        };
      }
    } catch (e) {
      console.warn("[PromptBuilder] Failed to fetch system info:", e);
    }

    const effectiveLang = aiLanguage;
    const mode: SystemPromptMode = systemPromptMode || "balanced";

    // Use combinePromptsForMode to support fast/balanced/thorough/autopilot modes.
    // systemInfo cast to any to satisfy PromptModeConfig shape (SystemInfo compatible).
    const systemPrompt = combinePromptsForMode(
      {
        language: effectiveLang,
        systemInfo: systemInfo as any,
      },
      mode,
    );

    return systemPrompt;
  }

  private static async buildAttachedContext(files: any[]): Promise<string> {
    const attachedItems = files.filter(
      (f: any) =>
        f.id?.startsWith("attached-") ||
        f.id?.startsWith("rule-") ||
        f.id?.startsWith("terminal-") ||
        f.id?.startsWith("snippet-") || // 🚀 NEW: Support text snippets
        f.id?.startsWith("external-"), // 🚀 NEW: Support external files
    );

    if (attachedItems.length === 0) return "";

    let attachedContextStr = "\n\n## Attached Context\n";

    const fileItems = attachedItems.filter((f: any) => f.type === "file");
    const terminalItems = attachedItems.filter(
      (f: any) => f.type === "terminal",
    );
    const snippetItems = attachedItems.filter(
      (f: any) => f.type === "text-snippet",
    ); // 🚀 NEW
    const externalItems = attachedItems.filter(
      (f: any) => f.type === "external",
    ); // 🚀 NEW

    if (fileItems.length > 0) {
      attachedContextStr += "\n### Files\n";
      fileItems.forEach((f: any) => {
        attachedContextStr += `- ${f.path}\n`;
      });
    }

    if (terminalItems.length > 0) {
      attachedContextStr += "\n### Terminals\n";
      terminalItems.forEach((f: any) => {
        attachedContextStr += `- terminal_id: ${f.path}\n`;
      });
    }

    // 🚀 NEW: Handle text snippets
    if (snippetItems.length > 0) {
      attachedContextStr += "\n### Text Snippets\n";
      snippetItems.forEach((f: any, index: number) => {
        attachedContextStr += `#### Snippet[${index + 1}] (${f.lineCount || 0} lines)\n\`\`\`\n${f.content || ""}\n\`\`\`\n`;
      });
    }

    // 🚀 NEW: Handle external files
    if (externalItems.length > 0) {
      attachedContextStr += "\n### External Files\n";
      externalItems.forEach((f: any) => {
        attachedContextStr += `#### ${f.path}\n\`\`\`\n${f.content || ""}\n\`\`\`\n`;
      });
    }

    return attachedContextStr;
  }
}
