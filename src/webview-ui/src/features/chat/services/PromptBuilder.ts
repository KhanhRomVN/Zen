import { combinePromptsForMode } from "../prompts";
import type { SystemPromptMode, PromptLengthMode } from "../prompts";
import { buildClaudePrompt } from "../prompts/claude-system-prompt";
import { extensionService } from "@/services/ExtensionService";
import { listInstalledSkills } from "@/features/marketplace/services/skillInstall.service";

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
  promptLengthMode?: PromptLengthMode;
  /** Đính kèm danh sách SKILL đã cài vào system-prompt (mặc định: tắt) */
  useSkillEnabled?: boolean;
  /** Provider ID của model đang dùng — nếu "claude" thì dùng claude-system-prompt */
  providerId?: string;
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
      files,
      userRequestCount,
      systemPromptMode,
      promptLengthMode,
      useSkillEnabled,
      providerId,
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
        promptLengthMode,
        useSkillEnabled,
        providerId,
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
    promptLengthMode?: PromptLengthMode,
    useSkillEnabled?: boolean,
    providerId?: string,
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

    // Provider claude → dùng claude-system-prompt riêng
    if (providerId === "claude") {
      const claudePrompt = buildClaudePrompt({
        language: effectiveLang,
      });
      if (!useSkillEnabled) return claudePrompt;
      const skillsSection = await this.buildSkillsSection(systemInfo.homeDir);
      return `${claudePrompt}${skillsSection}`;
    }

    const mode: SystemPromptMode = systemPromptMode || "balanced";

    // Use combinePromptsForMode to support simple/medium/promax modes.
    // systemInfo cast to any to satisfy PromptModeConfig shape (SystemInfo compatible).
    const systemPrompt = combinePromptsForMode(
      {
        language: effectiveLang,
        systemInfo: systemInfo as any,
        promptLengthMode: promptLengthMode || "long",
      },
      mode,
    );

    if (!useSkillEnabled) return systemPrompt;

    const skillsSection = await this.buildSkillsSection(systemInfo.homeDir);
    return `${systemPrompt}${skillsSection}`;
  }

  /**
   * Tạo section "Available Skills" từ các skill đã cài trong ~/.khanhromvn-zen/skills.
   * Trả về chuỗi rỗng nếu chưa cài skill nào hoặc đọc danh sách thất bại.
   */
  private static async buildSkillsSection(homeDir: string): Promise<string> {
    try {
      const skills = (await listInstalledSkills()).filter((s) => !!s.slug);
      if (skills.length === 0) return "";

      const lines = skills.map((s) => {
        const desc = (s.description || "").replace(/\s+/g, " ").trim();
        const shortDesc = desc.length > 200 ? `${desc.slice(0, 200)}…` : desc;
        // Cùng quy tắc chuẩn hoá tên file với SkillInstallHandler.slugToFile
        const safeSlug = (s.slug as string).replace(/[^a-zA-Z0-9._-]/g, "_");
        return `- **${s.name}**: ${shortDesc} (file: ${homeDir}/.khanhromvn-zen/skills/${safeSlug}.json)`;
      });

      return `\n\n## Available Skills\nInstalled skills you can use. When a task matches a skill's description, read its file for the full instructions before acting.\n${lines.join("\n")}`;
    } catch (e) {
      console.warn("[PromptBuilder] Failed to load installed skills:", e);
      return "";
    }
  }

  private static async buildAttachedContext(files: any[]): Promise<string> {
    const attachedItems = files.filter(
      (f: any) =>
        f.id?.startsWith("attached-") ||
        f.id?.startsWith("rule-") ||
        f.id?.startsWith("terminal-") ||
        f.id?.startsWith("snippet-") || // 🚀 NEW: Support text snippets
        f.id?.startsWith("external-") || // 🚀 NEW: Support external files
        f.type === "rule",
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
    const ruleItems = attachedItems.filter((f: any) => f.type === "rule");

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

    // Rule do người dùng chọn đính kèm — phải tuân theo trong suốt phiên làm việc.
    if (ruleItems.length > 0) {
      attachedContextStr += "\n### Rule\n";
      attachedContextStr += `You must strictly follow this rule (\"${ruleItems[0].path}\") for the rest of this conversation:\n\`\`\`\n${ruleItems[0].content || ""}\n\`\`\`\n`;
    }

    return attachedContextStr;
  }
}
