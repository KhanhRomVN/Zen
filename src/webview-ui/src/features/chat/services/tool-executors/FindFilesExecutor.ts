import { ToolExecutor, ExecutorContext, ExecutorOptions } from "./types";

export class FindFilesExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {}
  ): Promise<string | null> {
    const { getToolTimeout, extensionService, messageDispatcher } = context;

    return new Promise((resolve) => {
      const requestId = `find-${Date.now()}-${Math.random()}`;
      const fileNames = action.params.file_names || [];

      extensionService.postMessage({
        command: "findFiles",
        fileNames,
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            resolve(`[find_files] Result: Error - ${msg.error}`);
            return;
          }

          const results = msg.results || [];
          const totalMatches = msg.totalMatches || 0;

          let output = `[find_files] Found ${totalMatches} file(s)\n\n`;

          if (totalMatches === 0) {
            output += "No files found matching the search criteria.";
          } else {
            results.forEach((result: any) => {
              if (result.matches.length > 0) {
                output += `### ${result.fileName} (${result.matches.length} match${
                  result.matches.length === 1 ? "" : "es"
                })\n`;
                result.matches.forEach((match: any) => {
                  const matchPath =
                    typeof match === "string" ? match : match.path;
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
                          `${errorCount} error${errorCount > 1 ? "s" : ""}`
                        );
                      }
                      if (warningCount > 0) {
                        parts.push(
                          `${warningCount} warning${warningCount > 1 ? "s" : ""}`
                        );
                      }
                      diagnosticInfo = ` (${parts.join(", ")})`;
                    }
                  }

                  output += `- ${matchPath}${diagnosticInfo}\n`;
                });
                output += "\n";
              }
            });
          }

          resolve(output);
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[find_files] Timeout`, { requestId, fileNames });
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to find files.`;
          resolve(`[find_files] Result: Error - ${timeoutError}`);
        }
      );
    });
  }
}
