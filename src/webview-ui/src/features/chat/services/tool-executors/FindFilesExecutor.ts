import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { FindFilesParams } from "../parsers/FindFilesParser";

const FIND_FILES_TIMEOUT_MS = TOOL_TIMEOUTS.find_files || 30000;

export interface FindFilesResult {
  fileName: string;
  matches: string[];
}

/**
 * Execute find_files tool
 * Searches for files by name across the workspace
 */
export async function executeFindFiles(params: FindFilesParams): Promise<{
  output: string;
  results?: FindFilesResult[];
  totalMatches?: number;
} | null> {
  return new Promise((resolve) => {
    const requestId = `find-${Date.now()}-${Math.random()}`;
    const fileNames = params.file_names || [];

    extensionService.postMessage({
      command: "findFiles",
      fileNames,
      requestId,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve({
            output: `[find_files] Result: Error - ${msg.error}`,
          });
        } else {
          const results: FindFilesResult[] = msg.results || [];
          const totalMatches = msg.totalMatches || 0;

          // Format output
          let output = `[find_files] Found ${totalMatches} file(s)\n\n`;

          if (totalMatches === 0) {
            output += "No files found matching the search criteria.";
          } else {
            results.forEach((result) => {
              if (result.matches.length > 0) {
                output += `### ${result.fileName} (${result.matches.length} match${result.matches.length === 1 ? "" : "es"})\n`;
                result.matches.forEach((match) => {
                  output += `- ${match}\n`;
                });
                output += "\n";
              }
            });
          }

          resolve({
            output,
            results,
            totalMatches,
          });
        }
      },
      FIND_FILES_TIMEOUT_MS,
      () => {
        console.warn(`[find_files] Timeout`, { requestId, fileNames });
        resolve(null);
      },
    );
  });
}
