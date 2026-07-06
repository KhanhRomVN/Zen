import { extractParam, extractParamValue } from "../../utils/ToolParser";
import type { RunCommandParams } from "../../types/tool-types";

export const parseRunCommand = (innerContent: string): RunCommandParams => {
  return {
    // Try canonical name first (after normalization), then fallback to variants
    command: extractParam(innerContent, "command", "cmd", "Command", "CMD", "commandText", "command_text") || "",
    terminal_id: extractParam(innerContent, "terminal_id", "terminalId") || undefined,
    cwd: extractParamValue(innerContent, "cwd") || undefined,
  };
};