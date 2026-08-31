import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class FindFilesExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { getToolTimeout, extensionService, messageDispatcher } = context;

    return new Promise((resolve) => {
      const requestId = `find-${Date.now()}-${Math.random()}`;
      const fileName = action.params.file_name || "";
      const folderPath = action.params.folder_path;

      extensionService.postMessage({
        command: "findFiles",
        fileName,
        folderPath,
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            resolve(`[find_files] Result: Error - ${msg.error}`);
            return;
          }

          const matches = msg.matches || [];
          const totalMatches = msg.totalMatches || 0;
          const searchScope = msg.folderPath
            ? `in folder "${msg.folderPath}"`
            : "in entire workspace";

          let output = `[find_files] Searching for "${msg.fileName}" ${searchScope}\n`;
          output += `Found ${totalMatches} file(s)\n\n`;

          if (totalMatches === 0) {
            output += "No files found matching the search criteria.";
          } else {
            matches.forEach((match: any) => {
              const matchPath = typeof match === "string" ? match : match.path;
              let diagnosticInfo = "";

              if (
                typeof match === "object" &&
                (match.errorCount || match.warningCount)
              ) {
                const errorCount = match.errorCount || 0;
                const warningCount = match.warningCount || 0;

                if (errorCount > 0 || warningCount > 0) {
                  const parts: string[] = [];
                  if (errorCount > 0) {
                    parts.push(
                      `${errorCount} error${errorCount > 1 ? "s" : ""}`,
                    );
                  }
                  if (warningCount > 0) {
                    parts.push(
                      `${warningCount} warning${warningCount > 1 ? "s" : ""}`,
                    );
                  }
                  diagnosticInfo = ` (${parts.join(", ")})`;
                }
              }

              output += `- ${matchPath}${diagnosticInfo}\n`;
            });
          }

          resolve(output);
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[find_files] Timeout`, { requestId, fileName, folderPath });
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to find files.`;
          resolve(`[find_files] Result: Error - ${timeoutError}`);
        },
      );
    });
  }
}
