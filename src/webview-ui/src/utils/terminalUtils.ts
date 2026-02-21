/**
 * Utility to strip ANSI escape sequences, bracketed paste codes,
 * and terminal title codes from terminal output.
 */
export const stripAnsi = (str: string): string => {
  if (!str) return str;

  // Pattern for ANSI escape sequences
  const ansiPattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><;]))",
  ].join("|");

  const regex = new RegExp(ansiPattern, "g");
  let cleaned = str.replace(regex, "");

  // Strip Bracketed Paste Mode sequences specifically if they remain
  cleaned = cleaned.replace(/\x1b\[\?2004[hl]/g, "");

  // Strip Terminal Title sequences specifically if they remain
  cleaned = cleaned.replace(/\x1b\]0;.*?\x07/g, "");
  cleaned = cleaned.replace(/\x1b\]0;.*?\x1b\\/g, "");

  // --- Process \r (Carriage Return) ---
  // In terminal, \n usually is preceded by \r (\r\n).
  // Internal \r move cursor to start of line (overwriting).
  const lines = cleaned.split("\n");
  const processedLines = lines.map((line) => {
    // Remove trailing \r (part of \r\n sequence)
    let processed = line.endsWith("\r") ? line.slice(0, -1) : line;

    if (!processed.includes("\r")) return processed;

    // Handle internal \r (simulated overwrite)
    const parts = processed.split("\r");
    let lineResult = "";
    for (const part of parts) {
      // Overwrite logic: simplified but effective for most progress bars/prompts
      lineResult = part + lineResult.slice(part.length);
    }
    return lineResult;
  });

  return processedLines.join("\n");
};
