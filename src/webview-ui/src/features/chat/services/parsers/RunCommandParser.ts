import { extractParam, extractParamValue } from "../../utils/ToolParser";
import type { RunCommandParams } from "../../types/tool-types";

export const parseRunCommand = (innerContent: string): RunCommandParams => {
  return {
    command: extractParamValue(innerContent, "command") || "",
    terminal_id: extractParam(innerContent, "terminal_id", "terminalId") || undefined,
    cwd: extractParamValue(innerContent, "cwd") || undefined,
  };
};