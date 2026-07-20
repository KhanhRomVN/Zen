import { extractParamValue } from "../../utils/ToolParser";
import type { RunCommandParams } from "../../types/tool-types";

export const parseRunCommand = (innerContent: string): RunCommandParams => {
  // Parse according to tools-reference.ts schema: command (required), cwd (optional)
  // Note: terminal_id is not in official schema but kept for internal use
  return {
    command: extractParamValue(innerContent, "command") || "",
    terminal_id: extractParamValue(innerContent, "terminal_id") || undefined,
    cwd: extractParamValue(innerContent, "cwd") || undefined,
  };
};