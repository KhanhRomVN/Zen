import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { listInstalledSkills } from "@/features/marketplace/services/skillInstall.service";

/**
 * Executor cho tool list_skill — liệt kê skill đã cài local
 * (~/.khanhromvn-zen/skills), không cần tham số.
 */
export class ListSkillExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    _options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { setToolOutputs } = context;
    const actionId = action.actionId;

    try {
      const skills = await listInstalledSkills();

      const output =
        skills.length > 0
          ? skills
              .map(
                (s: any) =>
                  `- ${s.name} (slug: ${s.slug || "unknown"}): ${s.description || ""}`,
              )
              .join("\n")
          : "No skills installed.";

      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output, isError: false },
      }));

      return `[list_skill] Result:\n${output}`;
    } catch (err: any) {
      const errMsg = err?.message || "Failed to list installed skills";
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output: `Error - ${errMsg}`, isError: true },
      }));
      return `[list_skill] Result: Error - ${errMsg}`;
    }
  }
}