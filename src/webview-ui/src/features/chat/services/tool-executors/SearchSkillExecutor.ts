import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { searchSkills } from "@/features/marketplace/services/skill.service";

/**
 * Executor cho tool search_skill — tìm skill trên mcp.directory theo search_term,
 * trả về tên, description, views, installs của từng skill tìm được.
 */
export class SearchSkillExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    _options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { setToolOutputs } = context;
    const searchTerm = action.params.search_term || "";
    const actionId = action.actionId;

    if (action.params._validationError) {
      const errMsg = action.params._validationError;
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output: `Error - ${errMsg}`, isError: true },
      }));
      return `[search_skill for '${searchTerm}'] Result: Error - ${errMsg}`;
    }

    try {
      const response = await searchSkills(searchTerm);
      const skills = response?.skills || [];

      const output =
        skills.length > 0
          ? skills
              .map(
                (s) =>
                  `- ${s.name} (slug: ${s.slug})\n  description: ${s.description}\n  views: ${s.views}, installs: ${s.installs}`,
              )
              .join("\n")
          : "No skills found.";

      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output, isError: false },
      }));

      return `[search_skill for '${searchTerm}'] Result:\n${output}`;
    } catch (err: any) {
      const errMsg = err?.message || "Failed to search skills";
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: { output: `Error - ${errMsg}`, isError: true },
      }));
      return `[search_skill for '${searchTerm}'] Result: Error - ${errMsg}`;
    }
  }
}