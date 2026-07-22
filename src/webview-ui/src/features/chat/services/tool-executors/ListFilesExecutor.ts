import { ToolExecutor, ExecutorContext, ExecutorOptions } from "./types";

export class ListFilesExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {}
  ): Promise<string | null> {
    const { bypassIgnore = false } = options;
    const { setToolOutputs, getToolTimeout, extensionService, messageDispatcher } = context;

    return new Promise((resolve) => {
      const requestId = `list-${Date.now()}-${Math.random()}`;
      const folderPath = action.params.path || action.params.folder_path;
      const actionId = action.actionId;

      extensionService.postMessage({
        command: "listFiles",
        path: folderPath,
        recursive: action.params.recursive,
        depth: action.params.depth,
        type: action.params.type,
        requestId,
        bypassIgnore,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            resolve(
              `[list_files for '${folderPath}'] Result: Error - ${msg.error}`
            );
            return;
          }
          const listResults = msg.files || msg.results;

          // Check if folder is empty
          if (
            !listResults ||
            (typeof listResults === "string" &&
              listResults.trim() === "") ||
            (Array.isArray(listResults) && listResults.length === 0)
          ) {
            resolve(
              `[list_files for '${folderPath}'] Result: The folder '${folderPath}' is empty (no files or folders inside).`
            );
            return;
          }

          // Store the raw JSON tree data in toolOutputs for TreeBlock to consume
          if (Array.isArray(listResults) && actionId) {
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: listResults, // Store raw JSON array for UI
                isError: false,
              },
            }));

            // Format as readable tree for agent (no emojis, no tree lines)
            const formatTree = (
              nodes: any[],
              indent: string = ""
            ): string => {
              let result = "";
              nodes.forEach((node) => {
                // Node line (no tree characters, just indentation)
                if (node.type === "folder") {
                  result += `${indent}${node.name}/`;
                  if (node.children && node.children.length > 0) {
                    result += ` (${node.children.length} files)`;
                  }
                  result += "\n";
                  if (node.children && node.children.length > 0) {
                    result += formatTree(node.children, indent + "  ");
                  }
                } else {
                  result += `${indent}${node.name}`;
                  if (node.lines !== undefined) {
                    result += ` (${node.lines} lines)`;
                  }
                  result += "\n";
                }
              });
              return result;
            };

            const formattedOutput = formatTree(listResults);
            resolve(
              `[list_files for '${folderPath}'] Result:\n${formattedOutput}`
            );
          } else {
            // Fallback
            const outputStr =
              typeof listResults === "string"
                ? listResults
                : String(listResults);
            resolve(
              `[list_files for '${folderPath}'] Result:\n${outputStr}`
            );
          }
        },
        getToolTimeout(action.type),
        () => {
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to list files.`;
          resolve(
            `[list_files for '${folderPath}'] Result: Error - ${timeoutError}`
          );
        }
      );
    });
  }
}
