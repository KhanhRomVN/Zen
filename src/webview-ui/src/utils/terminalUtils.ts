/**
 * Utility to strip ANSI escape sequences from terminal output.
 */
export const stripAnsi = (str: string): string => {
  if (!str) return str;
  return str
    .replace(/\x1b\][0-9;]+.*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[\?2004[hl]/g, "")
    .replace(/[\u001B\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?[\u0007])|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><;]))/g, "")
    .replace(/\x07/g, "");
};
