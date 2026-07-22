import type { Diagnostic } from "../types/executor-types";

// Helper function to format diagnostics output
export function formatDiagnostics(
  diagnostics: any[],
  contentLines: string[]
): string {
  const errorCount = diagnostics.filter(
    (d: any) => d.severity === "Error" || d.severity === "error"
  ).length;
  const warningCount = diagnostics.filter(
    (d: any) => d.severity === "Warning" || d.severity === "warning"
  ).length;

  let output = `\n\n**Summary:** ${errorCount} error(s), ${warningCount} warning(s)`;

  const errors = diagnostics.filter(
    (d: any) => d.severity === "error" || d.severity === "Error"
  );
  const warnings = diagnostics.filter(
    (d: any) => d.severity === "warning" || d.severity === "Warning"
  );

  if (errors.length > 0) {
    output += `\n\n### Errors (${errors.length})\n`;
    errors.forEach((d: any, index: number) => {
      const lineContent = contentLines[d.line - 1] || "";
      const trimmedLine = lineContent.trim();
      output += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${
        d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""
      }: ${d.message}\n`;
    });
  }

  if (warnings.length > 0) {
    output += `\n### Warnings (${warnings.length})\n`;
    warnings.forEach((d: any, index: number) => {
      const lineContent = contentLines[d.line - 1] || "";
      const trimmedLine = lineContent.trim();
      output += `${index + 1}.  \`${trimmedLine}\` **Line ${d.line}**${
        d.source ? ` [${d.source}${d.code ? `:${d.code}` : ""}]` : ""
      }: ${d.message}\n`;
    });
  }

  return output;
}