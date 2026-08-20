import { extractParamValue } from "../../utils/ToolParser";
import type { RunCommandParams } from "../../types/tool-types";

export const parseRunCommand = (innerContent: string): RunCommandParams => {
  const folderPath =
    extractParamValue(innerContent, "folder_path") ||
    extractParamValue(innerContent, "folderPath") ||
    extractParamValue(innerContent, "cwd") ||
    undefined;

  return {
    command: extractParamValue(innerContent, "command") || "",
    terminal_id: extractParamValue(innerContent, "terminal_id") || undefined,
    cwd: folderPath,
    folder_path: folderPath,
    folderPath: folderPath,
  };
};