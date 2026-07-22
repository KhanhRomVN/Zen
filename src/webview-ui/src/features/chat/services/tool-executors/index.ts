// Export types
export * from "../../types/executor-types";

// Export executors
export { ReadFileExecutor } from "./ReadFileExecutor";
export { WriteToFileExecutor } from "./WriteToFileExecutor";
export { ReplaceInFileExecutor } from "./ReplaceInFileExecutor";
export { RevertFileExecutor } from "./RevertFileExecutor";
export { ViewReplaceHistoryExecutor } from "./ViewReplaceHistoryExecutor";
export { ListFilesExecutor } from "./ListFilesExecutor";
export { FindFilesExecutor } from "./FindFilesExecutor";
export { RunCommandExecutor } from "./RunCommandExecutor";
export { DeleteFileExecutor } from "./DeleteFileExecutor";
export { MoveFileExecutor } from "./MoveFileExecutor";
export { GrepExecutor } from "./GrepExecutor";
export { GitDiffExecutor } from "./GitDiffExecutor";

// Executor factory
import { ToolExecutor } from "../../types/executor-types";
import { ReadFileExecutor } from "./ReadFileExecutor";
import { WriteToFileExecutor } from "./WriteToFileExecutor";
import { ReplaceInFileExecutor } from "./ReplaceInFileExecutor";
import { RevertFileExecutor } from "./RevertFileExecutor";
import { ViewReplaceHistoryExecutor } from "./ViewReplaceHistoryExecutor";
import { ListFilesExecutor } from "./ListFilesExecutor";
import { FindFilesExecutor } from "./FindFilesExecutor";
import { RunCommandExecutor } from "./RunCommandExecutor";
import { DeleteFileExecutor } from "./DeleteFileExecutor";
import { MoveFileExecutor } from "./MoveFileExecutor";
import { GrepExecutor } from "./GrepExecutor";
import { GitDiffExecutor } from "./GitDiffExecutor";

/**
 * Factory function to get the appropriate executor for a given action type
 */
export function getExecutor(
  actionType: string,
  pendingToolResolvers?: Map<string, (result: string | null) => void>,
  commandStartTimes?: Map<string, number>,
  earlyCommandResults?: Map<string, any>,
): ToolExecutor | null {
  switch (actionType) {
    case "read_file":
      return new ReadFileExecutor();
    case "write_to_file":
      return new WriteToFileExecutor();
    case "replace_in_file":
      return new ReplaceInFileExecutor();
    case "revert_file":
      return new RevertFileExecutor();
    case "view_replace_history":
      return new ViewReplaceHistoryExecutor();
    case "list_files":
      return new ListFilesExecutor();
    case "find_files":
      return new FindFilesExecutor();
    case "run_command":
      if (!pendingToolResolvers || !commandStartTimes || !earlyCommandResults) {
        console.error("RunCommandExecutor requires additional dependencies");
        return null;
      }
      return new RunCommandExecutor(
        pendingToolResolvers,
        commandStartTimes,
        earlyCommandResults,
      );
    case "delete_file":
      return new DeleteFileExecutor();
    case "move_file":
      return new MoveFileExecutor();
    case "grep":
      return new GrepExecutor();
    case "git_diff":
      return new GitDiffExecutor();
    case "git_status":
      // git_status is display-only, no executor needed
      return null;
    case "commit_message":
      // commit_message is display-only, no executor needed
      return null;
    default:
      console.warn(
        `[Zen][tool] No executor found for action type: "${actionType}"`,
      );
      return null;
  }
}
