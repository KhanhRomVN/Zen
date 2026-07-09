import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { ReadFileParams } from "../../types/tool-types";

const READ_FILE_TIMEOUT_MS = TOOL_TIMEOUTS.read_file || 10000;

/**
 * Execute read_file tool
 * Reads file content from the extension
 */
export async function executeReadFile(
  params: ReadFileParams,
  bypassIgnore: boolean = false,
): Promise<{
  output: string;
  diagnostics?: Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }>;
} | null> {
  return new Promise((resolve) => {
    const requestId = `read-${Date.now()}-${Math.random()}`;
    const filePath = params.path || params.file_path || "";

    extensionService.postMessage({
      command: "readFile",
      path: filePath,
      start_line: params.start_line,
      end_line: params.end_line,
      requestId,
      bypassIgnore,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve({
            output: `[read_file for '${filePath}'] Result: Error - ${msg.error}`,
          });
        } else {
          const content = msg.content || "";
          let output = `[read_file for '${filePath}'] Result:\n\`\`\`\n${content}`;

          // Add diagnostics section if there are any warnings or errors
          if (msg.diagnostics && msg.diagnostics.length > 0) {
            const errorCount = msg.diagnostics.filter(
              (d: any) => d.severity === "error",
            ).length;
            const warningCount = msg.diagnostics.filter(
              (d: any) => d.severity === "warning",
            ).length;

            // Add diagnostics inside the code block
            output += `\n\n**Summary:** ${errorCount} error(s), ${warningCount} warning(s)\n\n`;

            // Get file content lines for context
            const contentLines = content.split("\n");

            // Group by severity
            const errors = msg.diagnostics.filter(
              (d: any) => d.severity === "error",
            );
            const warnings = msg.diagnostics.filter(
              (d: any) => d.severity === "warning",
            );

            if (errors.length > 0) {
              output += `### Errors (${errors.length})\n`;
              errors.forEach((d: any, index: number) => {
                const lineContent = contentLines[d.line - 1] || "";
                const trimmedLine = lineContent.trim();
                output += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
              });
              output += "\n";
            }

            if (warnings.length > 0) {
              output += `### Warnings (${warnings.length})\n`;
              warnings.forEach((d: any, index: number) => {
                const lineContent = contentLines[d.line - 1] || "";
                const trimmedLine = lineContent.trim();
                output += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""}: ${d.message}\n`;
              });
            }
          }

          // Close the code block
          output += `\`\`\``;

          resolve({
            output,
            diagnostics: msg.diagnostics || undefined,
          });
        }
      },
      READ_FILE_TIMEOUT_MS,
      () => {
        console.warn(`[read_file] Timeout`, { requestId, filePath });
        resolve(null);
      },
    );
  });
}
