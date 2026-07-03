import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { formatGrepResultCompact } from "../../utils/grepFormatter";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { GrepParams } from "../../types/tool-types";
const TIMEOUT_MS = TOOL_TIMEOUTS.grep || 30000;

/**
 * Execute grep tool
 * Searches for a term in files
 */
export async function executeGrep(params: GrepParams): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `grep-${Date.now()}-${Math.random()}`;
    const searchTerm = params.search_term || params.searchTerm || "";
    const filePath = params.file_path || params.filePath;
    const folderPath = params.folder_path || params.folderPath;
    const targetDesc = filePath || folderPath || "unknown";

    extensionService.postMessage({
      command: "executeAgentAction",
      action: {
        type: "grep",
        search_term: searchTerm,
        file_path: filePath,
        folder_path: folderPath,
        requestId,
        timestamp: Date.now(),
      },
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.result?.success) {
          const data = msg.result.data;
          const resultText = formatGrepResultCompact(data);
          resolve(
            `[grep for '${searchTerm}' in '${targetDesc}'] Result:\n${resultText}`,
          );
        } else {
          const errMsg = msg.result?.error || "Unknown error";
          console.warn(
            `[Zen][grep] Error | requestId=${requestId} | error="${errMsg}"`,
          );
          resolve(
            `[grep for '${searchTerm}' in '${targetDesc}'] Result: Error - ${errMsg}`,
          );
        }
      },
      TIMEOUT_MS,
      () => {
        console.warn(
          `[Zen][grep] Timeout | requestId=${requestId} | search_term="${searchTerm}" | target="${targetDesc}"`,
        );
        resolve(null);
      },
    );
  });
}
