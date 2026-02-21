/**
 * Utility to strip ANSI escape sequences, bracketed paste codes,
 * and terminal title codes from terminal output.
 */
export const stripAnsi = (str: string): string => {
  if (!str) return str;

  let cleaned = str;

  // 1. Strip Terminal Title (OSC) sequences FIRST
  // Match \x1b] followed by command and text, ended by BEL (\x07) or ST (\x1b\\)
  cleaned = cleaned.replace(/\x1b\][0-9;]+.*?(?:\x07|\x1b\\)/g, "");

  // 2. Strip Bracketed Paste Mode sequences specifically
  cleaned = cleaned.replace(/\x1b\[\?2004[hl]/g, "");

  // 3. Pattern for general ANSI escape sequences
  const ansiPattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><;]))",
  ].join("|");
  const regex = new RegExp(ansiPattern, "g");
  cleaned = cleaned.replace(regex, "");

  // Strip any remaining BEL characters
  cleaned = cleaned.replace(/\x07/g, "");

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
