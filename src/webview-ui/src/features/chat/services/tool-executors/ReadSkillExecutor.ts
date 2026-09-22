import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { fetchSkillDetail } from "@/features/marketplace/services/skill.service";

/**
 * Executor cho tool read_skill — fetch chi tiết + nội dung markdown đầy đủ
 * của 1 skill theo slug từ mcp.directory (không phụ thuộc skill đã cài local,
 * vì skill cài từ leaderboard/search có thể chỉ có SkillSummary, thiếu content).
 */
export class ReadSkillExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    _options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { setToolOutputs } = context;
    const slug = action.params.slug || "";
    const actionId = action.actionId;

    if (action.params._validationError) {
      const errMsg = action.params._validationError;
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output: `Error - ${errMsg}`, isError: true },
      }));
      return `[read_skill for '${slug}'] Result: Error - ${errMsg}`;
    }

    try {
      const detail = await fetchSkillDetail(slug);
      const output = [
        `Name: ${detail.name}`,
        `Description: ${detail.description}`,
        `Author: ${detail.author || "unknown"}`,
        `Views: ${detail.views ?? 0}`,
        `Installs: ${detail.installs ?? 0}`,
        "",
        detail.content || "",
      ].join("\n");

      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output, isError: false },
      }));

      return `[read_skill for '${slug}'] Result:\n${output}`;
    } catch (err: any) {
      const errMsg = err?.message || `Failed to read skill "${slug}"`;
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output: `Error - ${errMsg}`, isError: true },
      }));
      return `[read_skill for '${slug}'] Result: Error - ${errMsg}`;
    }
  }
}