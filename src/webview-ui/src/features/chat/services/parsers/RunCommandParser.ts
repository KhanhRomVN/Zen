import { extractParamValue } from "../../utils/ToolParser";
import type { RunCommandParams } from "../../types/tool-types";

export const parseRunCommand = (innerContent: string): RunCommandParams & { _is_sandbox?: boolean } => {
  const folderPath =
    extractParamValue(innerContent, "folder_path") ||
    extractParamValue(innerContent, "folderPath") ||
    extractParamValue(innerContent, "cwd") ||
    undefined;

  const isSandboxStr = extractParamValue(innerContent, "_is_sandbox");
  
  return {
    command: extractParamValue(innerContent, "command") || "",
    terminal_id: extractParamValue(innerContent, "terminal_id") || undefined,
    cwd: folderPath,
    folder_path: folderPath,
    folderPath: folderPath,
    _is_sandbox: isSandboxStr === "true",
  };
};
