import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { fetchSkillDetail } from "@/features/marketplace/services/skill.service";
import { installSkill } from "@/features/marketplace/services/skillInstall.service";

/**
 * Executor cho tool install_skill — fetch chi tiết skill theo slug rồi lưu
 * vào local (~/.khanhromvn-zen/skills), giống hệt luồng nút Install trong
 * Marketplace UI, đảm bảo skill cài luôn có đủ content/markdown.
 */
export class InstallSkillExecutor implements ToolExecutor {
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
      return `[install_skill for '${slug}'] Result: Error - ${errMsg}`;
    }

    try {
      const detail = await fetchSkillDetail(slug);
      await installSkill(detail);
      const output = `Installed skill "${detail.name}" (slug: ${slug}).`;

      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output, isError: false },
      }));

      return `[install_skill for '${slug}'] Result:\n${output}`;
    } catch (err: any) {
      const errMsg = err?.message || `Failed to install skill "${slug}"`;
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output: `Error - ${errMsg}`, isError: true },
      }));
      return `[install_skill for '${slug}'] Result: Error - ${errMsg}`;
    }
  }
}